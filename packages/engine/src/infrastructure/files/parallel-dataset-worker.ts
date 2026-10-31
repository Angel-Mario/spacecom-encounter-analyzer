import { once } from "node:events";
import { MessagePort, parentPort, workerData } from "node:worker_threads";

import { classifyEncounter } from "../../core/classifiers/encounter-classifier.js";
import { detectEncountersInGroup } from "../../core/detectors/encounter-detector.js";
import { UnsortedTimestampsError } from "../../core/grouping/timestamp-grouper.js";
import type { Encounter, MonitoredPerson, Timestamp } from "../../domain.js";
import { parseDatasetHeader, parseDatasetRow } from "../parsers/dataset-parser.js";
import { readLines } from "./dataset-line-reader.js";

// Um timestamp despachado para o chunk seguinte pode continuar recebendo
// registros lidos no chunk atual; essa é a razão do PEEK que olha para os
// primeiros bytes após a fronteira antes de decidir o que passa pelo relay.
const PEEK_WINDOW_BYTES = 262_144;

// ───── Protocolo do relay de carry ─────────────────────────────────────
//
// O processamento serial obtém, a todo momento, três informações globais do
// arquivo inteiro: qual é o último número de linha já consumido, qual é o
// último número de registro já emitido e qual é o grupo de timestamp em
// andamento (registros do MESMO timestamp ainda esperando o próximo). Com o
// arquivo dividido em chunks, nenhum worker conhece essas informações por
// completo; o arquivo é dividido para leitura, mas a semântica tem de se
// manter igual ao caminho serial.
//
// O "carry" é a troca de relatório entre chunks adjacentes que fecha essa
// lacuna: cada chunk, ao terminar seu próprio conjunto de bytes, repassa a
// seu sucessor (a) o grupo em andamento que transborda a fronteira e (b) os
// contadores acumulados até aquele ponto, para que o sucessor NUMERE seus
// registros e linhas exatamente como o caminho serial numeraria. A troca
// acontece exatamente uma vez por par de chunks adjacentes: nenhum worker
// lê bytes dos outros, portanto o relay é a única comunicação entre eles
// (os postMessages são, além disso, assíncronos e estruturados). Todos os
// encadeamentos começam do chunk zero, que abre com carry neutro: ele mesmo
// lê o header.
//
// Exemplo: uma linha do chunk 2 com erro de validação DEVE relatar "dataset
// row 4.000.123" — número absoluto que depende de quantos registros os
// chunks 0 e 1 processaram. Sem o carry (contadores de linha e registro),
// cada worker numeraria a partir de zero.
export interface CarryStep {
  lastLineNumber: number;
  lastRecordNumber: number;
  // Último timestamp emitido vs último timestamp em andamento: quando o
  // grupo da fronteira transborda, lastTimestamp é EXATAMENTE o timestamp
  // do grupo repassado; o sucessor usa esse valor para verificar ordem e
  // para juntar os registros à sua primeira entrada local.
  lastTimestamp: Timestamp | null;
  records: MonitoredPerson[];
}

export interface UnsortedMessage {
  currentTimestamp: Timestamp;
  previousTimestamp: Timestamp;
  recordNumber: number;
}

export interface WorkerTaskData {
  // Portas do MessageChannel criado no processo pai sobre pares de chunks
  // adjacentes; cada par carrega exatamente um CarryStep.
  carryIn?: MessagePort;
  carryOut?: MessagePort;
  chunkIndex: number;
  end: number;
  start: number;
}

export interface WorkerPayload {
  filePath: string;
  tasks: WorkerTaskData[];
}

export interface WorkerDoneMessage {
  chunkIndex: number;
  encounters: Encounter[];
  records: number;
  timestamps: number;
  type: "done";
}

export interface WorkerErrorMessage {
  chunkIndex: number;
  message: string;
  stack?: string;
  type: "error";
  unsorted?: UnsortedMessage;
}

interface GroupState {
  isFirst: boolean;
  records: MonitoredPerson[];
  timestamp: Timestamp;
}

// O recebimento do carry JAMAIS rejeita (CarryOutcome): um worker que não
// recebe o relay (par crashado ou porta fechada) não deve transformar isso
// numa rejeição pendente dangle — o processo pai é quem decide o erro do
// conjunto; os erros do relay apenas atrapalham a tarefa corrente.
interface CarryOutcome {
  error?: Error;
  ok: boolean;
  step?: CarryStep;
}

// Estado mutável do parsing de UM chunk; os helpers o recebem por referência
// para que a tarefa se desdobre em passos pequenos em vez de uma função
// fechada sobre uma dúzia de variáveis mutáveis.
interface TaskState {
  carry: CarryStep | null;
  carryApplied: boolean;
  deferredFirstGroup: GroupState | null;
  firstGroupSeen: boolean;
  firstRecordTimestamp: Timestamp | null;
  group: GroupState | null;
  lineIndex: number;
  lineNumberOffset: number;
  normalEncounters: Encounter[];
  prefixEncounters: Encounter[];
  previousTimestamp: Timestamp | undefined;
  recordCount: number;
  recordNumberOffset: number;
  timestampCount: number;
}

const isCarryStep = (value: unknown): value is CarryStep => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<CarryStep>;

  return (
    Array.isArray(candidate.records) &&
    typeof candidate.lastLineNumber === "number" &&
    typeof candidate.lastRecordNumber === "number" &&
    (candidate.lastTimestamp === null || typeof candidate.lastTimestamp === "string")
  );
};

const isWorkerTask = (value: unknown): value is WorkerTaskData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<WorkerTaskData>;

  return (
    typeof candidate.chunkIndex === "number" &&
    typeof candidate.end === "number" &&
    typeof candidate.start === "number"
  );
};

type CarriedEvent = { kind: "message"; value: unknown } | { kind: "close" };

// O processo pai cria cada MessageChannel e posta o carry ANTES de abrir o
// worker de trás, de modo que a mensagem costuma estar PRONTA quando este
// ponto chega; a MessagePort guarda mensagens postadas antes de qualquer
// listener existir — nada se perde, e os `once` a seguir simplesmente os
// recebem quando criados no mesmo ato, ANTES de qualquer await. A corrida
// (Promise.race) escuta a única mensagem de carry E o fechamento da porta
// pelo par (o transmissor pode ter falhado ANTES de postar): cada listener
// apenas espera até um dos lados acertar, e nenhum dos dois rejeita,
// portanto listeners pendentes tampouco geram rejeição pendente.
const receiveCarry = async (port: MessagePort): Promise<CarryOutcome> => {
  const settled = await Promise.race<CarriedEvent>([
    once(port, "message").then((values): CarriedEvent => ({
      kind: "message",
      value: values[0],
    })),
    once(port, "close").then((): CarriedEvent => ({ kind: "close" })),
  ]);

  port.close();

  if (settled.kind === "close") {
    return {
      error: new Error("The previous chunk ended without relaying its carry"),
      ok: false,
    };
  }
  if (isCarryStep(settled.value)) {
    return { ok: true, step: settled.value };
  }

  return {
    error: new Error("The previous chunk relayed an unexpected carry payload"),
    ok: false,
  };
};

const buildErrorMessage = (task: WorkerTaskData, error: unknown): WorkerErrorMessage => {
  const message: WorkerErrorMessage = {
    chunkIndex: task.chunkIndex,
    message: error instanceof Error ? error.message : String(error),
    type: "error",
  };

  if (error instanceof Error && error.stack !== undefined) {
    message.stack = error.stack;
  }

  if (error instanceof UnsortedTimestampsError) {
    message.unsorted = {
      currentTimestamp: error.currentTimestamp,
      previousTimestamp: error.previousTimestamp,
      recordNumber: error.recordNumber,
    };
  }

  return message;
};

const neutralCarry = (): CarryStep => ({
  lastLineNumber: 0,
  lastRecordNumber: 0,
  lastTimestamp: null,
  records: [],
});

const startTaskState = (task: WorkerTaskData): TaskState => ({
  // O chunk zero lê o próprio header, por isso abre com carry neutro; todo
  // outro chunk espera o relay do chunk anterior.
  carry: task.start === 0 ? neutralCarry() : null,
  carryApplied: false,
  deferredFirstGroup: null,
  firstGroupSeen: false,
  firstRecordTimestamp: null,
  group: null,
  lineIndex: -1,
  lineNumberOffset: 0,
  normalEncounters: [],
  prefixEncounters: [],
  previousTimestamp: undefined,
  recordCount: 0,
  recordNumberOffset: 0,
  timestampCount: 0,
});

const detectGroup = (state: TaskState, closed: GroupState): void => {
  state.timestampCount += 1;
  const container = closed.isFirst ? state.prefixEncounters : state.normalEncounters;
  for (const candidate of detectEncountersInGroup(closed.timestamp, closed.records)) {
    container.push(classifyEncounter(candidate));
  }
};

// ───── crossCheck: verificação de ordem na fronteira ───────────────────
//
// DENTRO do chunk, a ordem crescente é verificada linha a linha exatamente
// como no caminho serial. A queda de ordem no limite de fronteira (última
// linha de um chunk, primeira do outro) não pode ser verificada
// localmente: o worker só a apura quando o relay chega com o "até onde" o
// chunk anterior chegou. Os três casos, na ordem em que ocorrem:
//
// 1. primeiroTimestampLocal < carry.lastTimestamp → dataset fora de ordem
//    EXATAMENTE no registro subsequente ao último do chunk anterior: o erro
//    serializaria exatamente ali, com recordNumber = lastRecordNumber + 1.
// 2. primeiroTimestampLocal == carry.lastTimestamp → é o MESMO grupo de
//    timestamp atravessando a fronteira: os registros carregados se JUNTAM
//    ao primeiro grupo local (merged antes de tudo), como no serial.
// 3. primeiroTimestampLocal > carry.lastTimestamp → ordem crescente ok;
//    resta abortar se o chunk anterior carregou registros sem timestamp
//    compatível, o que só é possível montar com um relay mal construído.
//
// A verificação roda UMA vez por carry: tanto o recebimento do carry
// (ensureCarry dormente) quanto a chegada da primeira linha local podendo
// apurá-la a despacham — o hook que chega primeiro a aplica; daí carryApplied.
const crossCheck = (state: TaskState, message: CarryStep): void => {
  if (state.carryApplied) {
    return;
  }
  state.carryApplied = true;
  const carriedTimestamp = message.lastTimestamp;
  if (carriedTimestamp === null || state.firstRecordTimestamp === null) {
    return;
  }

  if (state.firstRecordTimestamp < carriedTimestamp) {
    throw new UnsortedTimestampsError(
      carriedTimestamp,
      state.firstRecordTimestamp,
      message.lastRecordNumber + 1,
    );
  }

  // O grupo que continua pode estar ABERTO (uma primeira linha local já o
  // abriu; está em state.group) ou DIFERIDO (a primeira entrada foi fechada
  // e aguarda o carry; está em deferredFirstGroup). Em ambos, os
  // registros carregados entram ANTES dos locais, como o serial agrupa.
  const continuingGroup =
    state.group !== null && state.group.isFirst ? state.group : state.deferredFirstGroup;
  if (state.firstRecordTimestamp === carriedTimestamp) {
    if (
      message.records.length === 0 ||
      continuingGroup === null ||
      continuingGroup.timestamp !== carriedTimestamp
    ) {
      // Sem sequência a juntar = plano de chunk versus arquivo fora de
      // sincronia: é um defeito de wiring, não de dataset.
      throw new Error("The carry relay does not line up with the first records of the next chunk");
    }

    const merged: MonitoredPerson[] = [];
    for (const record of message.records) {
      merged.push(record);
    }
    for (const record of continuingGroup.records) {
      merged.push(record);
    }
    continuingGroup.records = merged;
    return;
  }

  if (message.records.length > 0) {
    throw new Error(
      "The previous chunk relayed records that do not share the timestamp of the next chunk's first record",
    );
  }
};

const ensureCarry = async (
  state: TaskState,
  carryPromise: Promise<CarryOutcome> | null,
): Promise<CarryStep> => {
  if (state.carry !== null) {
    return state.carry;
  }
  if (carryPromise === null) {
    throw new Error("The worker has no carry input to receive");
  }

  const outcome = await carryPromise;
  if (!outcome.ok || outcome.step === undefined) {
    throw outcome.error ?? new Error("The carry relay failed");
  }

  const message = outcome.step;
  // Os contadores de registro e linha partem de onde o chunk anterior
  // parou; a partir deste ponto os erros de validação numeram
  // ABSOLUTAMENTE como o caminho serial numeraria.
  state.carry = message;
  state.recordNumberOffset = message.lastRecordNumber;
  state.lineNumberOffset = message.lastLineNumber;
  crossCheck(state, message);
  if (state.deferredFirstGroup !== null) {
    // Primeiro grupo local fechado ANTES de obter o carry: com o carry em
    // mãos o grupo fecha e é detectado (caso 2 do crossCheck insere os
    // registros carregados para dentro dele).
    const closed = state.deferredFirstGroup;
    state.deferredFirstGroup = null;
    detectGroup(state, closed);
  }

  return message;
};

// Lê a primeira linha não vazia PASSADA a fronteira do chunk; esse timestamp
// decide se o grupo em andamento continua no chunk seguinte (indo TODOS os
// registros para o relay) ou se ele se encerra aqui (sendo detectado
// localmente). A janela PEEK_WINDOW_BYTES termina além do fim do arquivo na
// cauda do dataset; nesse caso o read simplesmente termina em silêncio e
// retorna `undefined` — sem erro, como convém ao fim de arquivo.
const peekTimestamp = async (
  filePath: string,
  task: WorkerTaskData,
  state: TaskState,
): Promise<Timestamp | undefined> => {
  let peekIndex = 0;
  for await (const line of readLines(filePath, {
    end: task.end + PEEK_WINDOW_BYTES,
    start: task.end,
  })) {
    peekIndex += 1;
    const row = parseDatasetRow(line, state.lineNumberOffset + state.lineIndex + 1 + peekIndex);
    if (row !== undefined) {
      return row.timestamp;
    }
  }

  return undefined;
};

const parseChunkLine = async (
  state: TaskState,
  carryPromise: Promise<CarryOutcome> | null,
  line: string,
): Promise<MonitoredPerson | undefined> => {
  try {
    return parseDatasetRow(line, state.lineNumberOffset + state.lineIndex + 1);
  } catch (error) {
    if (state.carry !== null) {
      throw error;
    }
    // O erro de parse levantado ANTES do carry chegar pode citar um número
    // de registro PROVISÓRIO (numeração local). O grupo de código acima
    // força o carry (que trava a numeração absoluta) e revalida APENAS a
    // linha em questão: se ela era de fato inválida, o erro sobe de novo
    // agora com o número de registro final exato como no serial.
    await ensureCarry(state, carryPromise);
    parseDatasetRow(line, state.lineNumberOffset + state.lineIndex + 1);
    throw error;
  }
};

const parseChunkLines = async (
  state: TaskState,
  filePath: string,
  task: WorkerTaskData,
  carryPromise: Promise<CarryOutcome> | null,
): Promise<void> => {
  for await (const line of readLines(filePath, {
    end: task.end,
    start: task.start,
  })) {
    state.lineIndex += 1;
    if (task.start === 0 && state.lineIndex === 0) {
      parseDatasetHeader(line);
      continue;
    }

    const person = await parseChunkLine(state, carryPromise, line);
    if (person === undefined) {
      continue;
    }
    state.recordCount += 1;
    const { timestamp } = person;

    // Ordem crescente DENTRO do chunk, exatamente como no serial; a queda
    // de ordem na fronteira é verificada apenas quando o carry chega.
    if (state.previousTimestamp !== undefined && timestamp < state.previousTimestamp) {
      if (state.carry === null) {
        await ensureCarry(state, carryPromise);
      }
      throw new UnsortedTimestampsError(
        state.previousTimestamp,
        timestamp,
        state.recordNumberOffset + state.recordCount,
      );
    }

    if (state.group !== null && timestamp === state.group.timestamp) {
      state.group.records.push(person);
      state.previousTimestamp = timestamp;
      continue;
    }

    if (state.group !== null) {
      const closed = state.group;
      state.group = null;
      if (closed.isFirst && state.carry === null) {
        // A primeira entrada LOCAL pode ainda receber registros carregados;
        // sua detecção espera o carry e cai no topo do chunk (caso 2 de
        // crossCheck), portanto o fechamento fica DIFERIDO.
        state.deferredFirstGroup = closed;
      } else {
        detectGroup(state, closed);
      }
    }

    // Primeiro timestamp LOCAL: é o referencial do crossCheck com o carry.
    const isFirst = !state.firstGroupSeen;
    state.firstGroupSeen = true;
    state.group = { isFirst, records: [person], timestamp };
    if (state.firstRecordTimestamp === null) {
      state.firstRecordTimestamp = timestamp;
    }
    if (state.carry !== null) {
      // Caso raro: o carry tinha chegado com a linha seguinte ainda ONDE;
      // a chegada da primeira entrada LOCAL dispara a verificação nos
      // mesmos hábitos que o hook de recebimento (carryApplied torna a
      // segunda chamada vira no-op).
      crossCheck(state, state.carry);
    }
    state.previousTimestamp = timestamp;
  }
};

// ───── settleChunk: decisão de encerramento do chunk ───────────────────
//
// Ao fim da leitura há exatamente dois destinos possíveis para o grupo em
// andamento:
//
// 1. Nenhum registro parseado no chunk → os registros recebidos no carry
//    (se houver) seguem ADIANTE intactos: o relay do chunk seguinte precisa
//    encontrá-los para juntá-los à sua primeira entrada local.
// 2. Há grupo em andamento → o peek decide: (a) o timestamp seguinte IGUAL
//    ao grupo → o grupo INTEIRO passa ao sucessor (é ele quem fecha a
//    detecção: a saída de encontros e a contagem de registros ficam
//    exatamente como no serial); (b) timestamp DIFERENTE (ou fim de
//    arquivo) → o grupo fecha localmente e o carry segue VAZIO de
//    registros, com lastTimestamp marcando apenas o timestamp fechado.
//
// Contadores acumulados estão sempre no carry: as contagens de registro e
// linha do chunk seguinte partem de onde este chunk parou.
const settleChunk = async (
  state: TaskState,
  filePath: string,
  task: WorkerTaskData,
  carryPromise: Promise<CarryOutcome> | null,
): Promise<CarryStep> => {
  const relayedCarry = await ensureCarry(state, carryPromise);
  if (task.start === 0 && state.lineIndex < 0) {
    // Arquivo vazio: nenhum byte (nem mesmo o header) foi consumido.
    throw new Error("Dataset is empty");
  }

  const lastLineNumber = state.lineNumberOffset + state.lineIndex + 1;
  const lastRecordNumber = state.recordNumberOffset + state.recordCount;

  if (state.group === null) {
    // O chunk parseou nenhum registro: repasse direto do carry de entrada.
    return {
      lastLineNumber,
      lastRecordNumber,
      lastTimestamp: relayedCarry.lastTimestamp,
      records: relayedCarry.records,
    };
  }

  const { group } = state;
  const peekedTimestamp = await peekTimestamp(filePath, task, state);
  if (peekedTimestamp === group.timestamp) {
    return {
      lastLineNumber,
      lastRecordNumber,
      lastTimestamp: group.timestamp,
      records: group.records,
    };
  }

  state.group = null;
  detectGroup(state, group);
  return {
    lastLineNumber,
    lastRecordNumber,
    lastTimestamp: group.timestamp,
    records: [],
  };
};

const runWorkerTask = async (
  filePath: string,
  task: WorkerTaskData,
  parent: MessagePort,
): Promise<void> => {
  const carryIn = task.carryIn instanceof MessagePort ? task.carryIn : null;
  const carryOut = task.carryOut instanceof MessagePort ? task.carryOut : null;
  const carryPromise = carryIn === null ? null : receiveCarry(carryIn);
  const state = startTaskState(task);
  let relayed = false;

  try {
    await parseChunkLines(state, filePath, task, carryPromise);
    const carryStep = await settleChunk(state, filePath, task, carryPromise);

    if (carryOut !== null) {
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      carryOut.postMessage(carryStep);
      carryOut.close();
      relayed = true;
    }

    // Encontros do grupo DIFERIDO primeiro: quando a primeira entrada do
    // chunk estava parcialmente na fronteira, os encontros serialmente
    // detectados para ela PRECEDEM os dos grupos totalmente locais.
    const encounters = [...state.prefixEncounters, ...state.normalEncounters];
    const done: WorkerDoneMessage = {
      chunkIndex: task.chunkIndex,
      encounters,
      records: state.recordCount,
      timestamps: state.timestampCount,
      type: "done",
    };
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    parent.postMessage(done);
  } finally {
    // Tarefa que falhou ANTES de repor o carry fecha a porta: o chunk
    // seguinte identifica isso no receiveCarry como fechamento do par em
    // vez de ficar sem resposta para o restante do processamento.
    if (carryOut !== null && !relayed) {
      carryOut.close();
    }
  }
};

const main = async (): Promise<void> => {
  const parent = parentPort;
  if (parent === null) {
    // Carregar este módulo fora de um thread de worker é um erro de wiring
    // apenas; nada a processar.
    return;
  }

  if (typeof workerData !== "object" || workerData === null) {
    throw new Error("The parallel dataset worker received invalid workerData");
  }
  const payload = workerData as Partial<WorkerPayload>;
  if (typeof payload.filePath !== "string" || !Array.isArray(payload.tasks)) {
    throw new TypeError("The parallel dataset worker received invalid tasks");
  }

  for (const task of payload.tasks) {
    if (!isWorkerTask(task)) {
      throw new TypeError("The parallel dataset worker received an invalid task");
    }
    try {
      // Os chunks de um mesmo worker executam EM ORDEM: a corrente de carry
      // carry dependente do fato de o chunk de trás ter repassado seu
      // estado antes do próximo abrir.
      // eslint-disable-next-line no-await-in-loop
      await runWorkerTask(payload.filePath, task, parent);
    } catch (error) {
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      parent.postMessage(buildErrorMessage(task, error));
      // O worker sai com código não zero: o processo pai rejeita todos os
      // futures que agora jamais vão assentar, abortando o processamento
      // por inteiro.
      process.exitCode = 1;
      return;
    }
  }
};

await main();
