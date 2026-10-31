import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import type { MessagePort } from "node:worker_threads";
import { MessageChannel, Worker } from "node:worker_threads";

import { classifyEncounter } from "../../core/classifiers/encounter-classifier.js";
import { detectEncountersInGroup } from "../../core/detectors/encounter-detector.js";
import { UnsortedTimestampsError } from "../../core/grouping/timestamp-grouper.js";
import type { Encounter } from "../../domain.js";
import { ENV } from "../../env.js";
import type { DatasetChunk } from "./chunk-planner.js";
import { planDatasetChunks } from "./chunk-planner.js";
import { readDatasetGroups } from "./file-dataset-reader.js";
import type {
  WorkerDoneMessage,
  WorkerErrorMessage,
  WorkerPayload,
  WorkerTaskData,
} from "./parallel-dataset-worker.js";

const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

// ───── analyzeDatasetParallel: orquestração no processo pai ────────────
//
// O paralelismo é por CHUNK (faixa de bytes), não por timestamp: os grupos
// de um mesmo timestamp podem trocar entre uma faixa e outra e a ordem dos
// encontros precisa permanecer a do arquivo. O lote funciona assim:
//
// 1. planDatasetChunks corta o arquivo em faixas alinhadas por linha.
// 2. buildTaskWiring distribui as faixas round-robin entre workers e cria
//    um MessageChannel por par de faixas adjacentes (a corrente de carry).
// 3. openWorkers abre um thread por worker com as portas na transferList
//    e conecta três handlers: mensagem (done/error de chunk), crash e
//    exit prematuro.
// 4. collectChunkOutputs assenta os futures na ORDEM DOS CHUNKS (allSettled)
//    e faz a primeira rejeição nessa ordem vencer — o mesmo erro que o
//    caminho serial teria lançado antes.
//
// Daí por diante, entra o protocolo de relay detalhado em
// parallel-dataset-worker.ts (CarryStep, crossCheck, peekTimestamp).

export interface ParallelDatasetOptions {
  // Tamanho alvo, em bytes, de cada chunk; valores pequenos são usados por
  // testes para forçar vários chunks a partir de um fixture mínimo.
  chunkBytes?: number;
  maxWorkers?: number;
}

export interface ParallelDatasetAnalysis {
  encounters: Encounter[];
  records: number;
  timestamps: number;
}

interface ChunkOutput {
  encounters: Encounter[];
  records: number;
  timestamps: number;
}

// Fila de tarefas de chunk de cada worker, junto das portas que precisam
// ser transferidas no momento da abertura do thread.
interface WorkerWiring {
  tasks: WorkerTaskData[];
  transfers: MessagePort[];
}

const isWorkerDoneMessage = (value: unknown): value is WorkerDoneMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<WorkerDoneMessage>;

  return (
    candidate.type === "done" &&
    typeof candidate.chunkIndex === "number" &&
    Array.isArray(candidate.encounters) &&
    typeof candidate.records === "number" &&
    typeof candidate.timestamps === "number"
  );
};

const isWorkerErrorMessage = (value: unknown): value is WorkerErrorMessage => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<WorkerErrorMessage>;

  return (
    candidate.type === "error" &&
    typeof candidate.chunkIndex === "number" &&
    typeof candidate.message === "string"
  );
};

const resolveWorkerUrl = (): URL => {
  // O Node com strip-types não mapeia importações ".js" para ".ts", então o
  // worker não pode abrir diretamente do código-fonte: é preciso abrir um
  // arquivo .mjs compilado.
  //
  // Consumidores empacotados (o dist do engine ou o bundle da CLI) carregam
  // a entrada do worker emitida como arquivo irmão do bundle importador.
  const bundledUrl = new URL("parallel-dataset-worker.mjs", import.meta.url);
  if (existsSync(bundledUrl)) {
    return bundledUrl;
  }

  // Execuções a partir do código-fonte (vitest) caem na entrada compilada
  // do pacote engine.
  const builtUrl = new URL("../../../dist/parallel-dataset-worker.mjs", import.meta.url);
  if (existsSync(builtUrl)) {
    return builtUrl;
  }

  throw new Error(
    "The parallel dataset worker entry is missing; build the engine package once (pnpm --filter @spacecom-encounter-analyzer/engine build) to spawn worker threads",
  );
};

const analyzeDatasetSerial = async (filePath: string): Promise<ParallelDatasetAnalysis> => {
  const analysis: ParallelDatasetAnalysis = {
    encounters: [],
    records: 0,
    timestamps: 0,
  };

  for await (const [timestamp, people] of readDatasetGroups(filePath)) {
    analysis.records += people.length;
    analysis.timestamps += 1;
    for (const candidate of detectEncountersInGroup(timestamp, people)) {
      analysis.encounters.push(classifyEncounter(candidate));
    }
  }

  return analysis;
};

const rejectUnfinishedChunks = (
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
  error: Error,
): void => {
  for (const future of futures.values()) {
    future.reject(error);
  }
};

const rejectWithErrorMessage = (
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
  message: WorkerErrorMessage,
): void => {
  const future = futures.get(message.chunkIndex);
  if (future === undefined) {
    return;
  }
  if (message.unsorted === undefined) {
    future.reject(new Error(message.message));
    return;
  }

  // Um UnsortedTimestampsError cruzou a fronteira do thread como mensagem
  // estruturada; aqui ele volta ao tipo original para que o chamador
  // (fallback de ordenação externa na CLI, por exemplo) trate-o por
  // instanceof exatamente como no caminho serial.
  const { currentTimestamp, previousTimestamp, recordNumber } = message.unsorted;
  future.reject(new UnsortedTimestampsError(previousTimestamp, currentTimestamp, recordNumber));
};

const handleWorkerMessage = (
  message: unknown,
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
): void => {
  if (isWorkerErrorMessage(message)) {
    rejectWithErrorMessage(futures, message);
    return;
  }
  if (!isWorkerDoneMessage(message)) {
    return;
  }

  const future = futures.get(message.chunkIndex);
  if (future === undefined) {
    return;
  }
  future.resolve({
    encounters: message.encounters,
    records: message.records,
    timestamps: message.timestamps,
  });
};

const handleWorkerError = (
  error: unknown,
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
): void => {
  const description = error instanceof Error ? error.message : String(error);
  rejectUnfinishedChunks(
    futures,
    new Error(`A parallel dataset worker thread crashed: ${description}`),
  );
};

const handleWorkerExit = (
  exitCode: number,
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
): void => {
  if (exitCode === 0) {
    return;
  }
  rejectUnfinishedChunks(
    futures,
    new Error(
      `A parallel dataset worker thread exited with code ${exitCode} before settling every chunk`,
    ),
  );
};

// allSettled mantém toda rejeição tratada; a primeira rejeição em ordem de
// chunk é a que o caminho serial teria lançado antes, então é ela que vence.
const collectChunkOutputs = async (
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
  chunkCount: number,
): Promise<ChunkOutput[]> => {
  const promises: Promise<ChunkOutput>[] = [];
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const future = futures.get(chunkIndex);
    if (future === undefined) {
      throw new Error("The parallel chunk plan is inconsistent");
    }
    promises.push(future.promise);
  }

  const settled = await Promise.allSettled(promises);
  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      throw outcome.reason;
    }
  }

  const outputs: ChunkOutput[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      outputs.push(outcome.value);
    }
  }

  return outputs;
};

const buildAnalysis = (outputs: ChunkOutput[]): ParallelDatasetAnalysis => {
  const analysis: ParallelDatasetAnalysis = {
    encounters: [],
    records: 0,
    timestamps: 0,
  };
  for (const output of outputs) {
    analysis.records += output.records;
    analysis.timestamps += output.timestamps;
    for (const encounter of output.encounters) {
      analysis.encounters.push(encounter);
    }
  }

  return analysis;
};

// Atribuição round-robin mantém a fila de cada worker ordenada pelo índice
// do chunk; o relay de carry só flui entre chunks adjacentes, de modo que
// os grupos de fronteira permanecem fundidos.
const buildTaskWiring = (chunks: DatasetChunk[], workerCount: number): WorkerWiring[] => {
  const wirings: WorkerWiring[] = [];
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    wirings.push({ tasks: [], transfers: [] });
  }

  const carryOutPorts = new Map<number, MessagePort>();
  const carryInPorts = new Map<number, MessagePort>();
  // Uma porta do canal vai a um chunk (saída) e a outra ao chunk seguinte
  // (entrada); o par atravessa a fronteira do thread pela transferList do
  // worker aberto.
  for (let chunkIndex = 0; chunkIndex + 1 < chunks.length; chunkIndex += 1) {
    const channel = new MessageChannel();
    carryOutPorts.set(chunkIndex, channel.port1);
    carryInPorts.set(chunkIndex + 1, channel.port2);
  }

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const wiring = wirings[chunkIndex % workerCount];
    if (wiring === undefined) {
      throw new Error("The parallel chunk plan is inconsistent");
    }

    const task: WorkerTaskData = {
      chunkIndex,
      end: chunk.end,
      start: chunk.start,
    };
    const carryInPort = carryInPorts.get(chunkIndex);
    const carryOutPort = carryOutPorts.get(chunkIndex);
    if (carryInPort !== undefined) {
      task.carryIn = carryInPort;
      wiring.transfers.push(carryInPort);
    }
    if (carryOutPort !== undefined) {
      task.carryOut = carryOutPort;
      wiring.transfers.push(carryOutPort);
    }
    wiring.tasks.push(task);
  }

  return wirings;
};

const openWorkers = (
  filePath: string,
  workerUrl: URL,
  wirings: WorkerWiring[],
  futures: Map<number, PromiseWithResolvers<ChunkOutput>>,
): Worker[] => {
  const workers: Worker[] = [];
  for (const wiring of wirings) {
    const payload: WorkerPayload = { filePath, tasks: wiring.tasks };
    const worker = new Worker(workerUrl, {
      // execArgv vazio impede que as flags do processo principal (por
      // exemplo --watch, ou strip-types em modo dev) vazem nos threads;
      // o worker abre de um .mjs compilado, que não precisa delas.
      execArgv: [],
      transferList: wiring.transfers,
      workerData: payload,
    });
    workers.push(worker);

    worker.on("message", (message: unknown) => {
      handleWorkerMessage(message, futures);
    });
    worker.on("error", (error: unknown) => {
      handleWorkerError(error, futures);
    });
    worker.on("exit", (exitCode: number) => {
      handleWorkerExit(exitCode, futures);
    });
  }

  return workers;
};

export const analyzeDatasetParallel = async (
  filePath: string,
  options?: ParallelDatasetOptions,
): Promise<ParallelDatasetAnalysis> => {
  const chunkBytes = options?.chunkBytes ?? ENV.SPACECOM_CHUNK_BYTES ?? DEFAULT_CHUNK_BYTES;
  const maxWorkers = Math.max(
    1,
    options?.maxWorkers ?? ENV.SPACECOM_MAX_WORKERS ?? os.availableParallelism() - 1,
  );
  const { size } = await stat(filePath);
  if (size < chunkBytes * 2) {
    // Arquivos pequenos demais para se dividir com segurança seguem pelo
    // caminho serial no próprio processo (a troca de mensagens custaria
    // mais que o processamento em si).
    return analyzeDatasetSerial(filePath);
  }

  // O alvo de chunks limita cada fatia a chunkBytes e não passa de
  // maxWorkers workers: mais threads que núcleos não aceleram leitura
  // CPU-bound e cada thread carrega um custo de abertura fixo.
  const chunkCountTarget = Math.max(2, Math.min(Math.floor(size / chunkBytes), maxWorkers));
  const chunks = await planDatasetChunks(filePath, chunkCountTarget);
  const chunkCount = chunks.length;
  const workerCount = Math.min(chunkCount, maxWorkers);
  const wirings = buildTaskWiring(chunks, workerCount);

  // Futuros por chunk: cada um só assenta quando o chunk correspondente
  // manda "done" (ou rejeita com o erro daquele chunk, na ordem do
  // serial).
  const futures = new Map<number, PromiseWithResolvers<ChunkOutput>>();
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    futures.set(chunkIndex, Promise.withResolvers<ChunkOutput>());
  }

  const workerUrl = resolveWorkerUrl();
  const workers = openWorkers(filePath, workerUrl, wirings, futures);

  try {
    return buildAnalysis(await collectChunkOutputs(futures, chunkCount));
  } finally {
    // Encerra qualquer thread remanescente (após erro também), evitando
    // processos órfãos depois de falhas ou cancelamentos do consumidor.
    await Promise.allSettled(workers.map((worker) => worker.terminate()));
  }
};
