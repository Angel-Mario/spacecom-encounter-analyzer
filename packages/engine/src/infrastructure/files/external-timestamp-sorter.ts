import { createReadStream } from "node:fs";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import { z } from "zod";

import type { MonitoredPerson, Timestamp } from "../../domain.js";

const DEFAULT_CHUNK_SIZE = 25_000;
const MAX_MERGE_FAN_IN = 64;

const SortRecordSchema = z.object({
  person: z.object({
    factionId: z.number().int().nullable(),
    hasProtectiveMeasure: z.boolean(),
    id: z.number().int(),
    latitude: z.number(),
    longitude: z.number(),
    restrictedIds: z.array(z.number().int()),
    timestamp: z.string(),
  }),
  sequence: z.number().int().nonnegative(),
});

type SortRecord = z.infer<typeof SortRecordSchema>;

interface RunCursor {
  close: () => void;
  iterator: AsyncIterator<string>;
  record: SortRecord;
}

export interface ExternalSortOptions {
  chunkSize?: number;
  temporaryDirectory?: string;
}

// Em timestamps iguais, a sequência preserva a ordem original dos registros.
const compareRecords = (first: SortRecord, second: SortRecord): number =>
  first.person.timestamp.localeCompare(second.person.timestamp) || first.sequence - second.sequence;

const writeSortedRun = async (chunk: SortRecord[], runPath: string): Promise<void> => {
  const sortedRecords = chunk.toSorted(compareRecords);
  const content = `${sortedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`;
  await writeFile(runPath, content, "utf-8");
};

const parseSortRecord = (line: string): SortRecord => {
  const parsedRecord = SortRecordSchema.safeParse(JSON.parse(line));
  if (!parsedRecord.success) {
    throw new Error("Invalid temporary record during external timestamp sort", {
      cause: parsedRecord.error,
    });
  }

  return parsedRecord.data;
};

const openRunCursor = async (runPath: string): Promise<RunCursor | undefined> => {
  const input = createReadStream(runPath);
  const lines = createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input });
  const iterator = lines[Symbol.asyncIterator]();

  try {
    const firstLine = await iterator.next();
    if (firstLine.done) {
      lines.close();
      input.destroy();
      return undefined;
    }

    return {
      close: () => {
        lines.close();
        input.destroy();
      },
      iterator,
      record: parseSortRecord(firstLine.value),
    };
  } catch (error) {
    lines.close();
    input.destroy();
    throw error;
  }
};

const pushCursor = (heap: RunCursor[], cursor: RunCursor): void => {
  // O menor timestamp fica no topo para ser processado primeiro.
  heap.push(cursor);
  let index = heap.length - 1;

  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    const parent = heap[parentIndex];
    const current = heap[index];
    if (!parent || !current || compareRecords(parent.record, current.record) <= 0) {
      break;
    }

    heap[parentIndex] = current;
    heap[index] = parent;
    index = parentIndex;
  }
};

const popCursor = (heap: RunCursor[]): RunCursor | undefined => {
  // Remove o próximo registro da intercalação e reorganiza o heap.
  const [first] = heap;
  const last = heap.pop();

  if (!first || !last || heap.length === 0) {
    return first;
  }

  heap[0] = last;
  let index = 0;

  while (true) {
    const leftIndex = index * 2 + 1;
    const rightIndex = leftIndex + 1;
    const left = heap[leftIndex];
    const right = heap[rightIndex];
    const current = heap[index];
    if (!current) {
      break;
    }

    let smallestIndex = index;
    if (left && compareRecords(left.record, current.record) < 0) {
      smallestIndex = leftIndex;
    }

    const [smallest] = heap.slice(smallestIndex);
    if (right && smallest && compareRecords(right.record, smallest.record) < 0) {
      smallestIndex = rightIndex;
    }

    if (smallestIndex === index) {
      break;
    }

    const next = heap[smallestIndex];
    if (!next) {
      break;
    }

    heap[index] = next;
    heap[smallestIndex] = current;
    index = smallestIndex;
  }

  return first;
};

const mergeRuns = async function* mergeRuns(runPaths: string[]): AsyncGenerator<SortRecord> {
  const heap: RunCursor[] = [];
  const cursors: RunCursor[] = [];

  try {
    // Cada arquivo contribui com um registro por vez, sem carregar a execução inteira.
    const cursorResults = await Promise.allSettled(runPaths.map(openRunCursor));
    for (const result of cursorResults) {
      if (result.status === "fulfilled" && result.value) {
        cursors.push(result.value);
        pushCursor(heap, result.value);
      }
    }

    const failedResult = cursorResults.find((result) => result.status === "rejected");
    if (failedResult?.status === "rejected") {
      throw failedResult.reason;
    }

    while (heap.length > 0) {
      const cursor = popCursor(heap);
      if (!cursor) {
        break;
      }

      yield cursor.record;

      // Lê o próximo registro antes de avançar para preservar a ordem do merge.
      // eslint-disable-next-line no-await-in-loop
      const nextLine = await cursor.iterator.next();
      if (!nextLine.done) {
        cursor.record = parseSortRecord(nextLine.value);
        pushCursor(heap, cursor);
      }
    }
  } finally {
    for (const cursor of cursors) {
      cursor.close();
    }
  }
};

const mergeRunBatch = async (runPaths: string[], outputPath: string): Promise<void> => {
  const output = await open(outputPath, "w");

  try {
    for await (const record of mergeRuns(runPaths)) {
      await output.write(`${JSON.stringify(record)}\n`, null, "utf-8");
    }
  } finally {
    await output.close();
  }
};

const mergeRunBatchToPath = async (
  runPaths: string[],
  temporaryDirectory: string,
  pass: number,
  batchNumber: number,
): Promise<string> => {
  const [onlyPath] = runPaths;
  if (runPaths.length === 1 && onlyPath) {
    return onlyPath;
  }

  const outputPath = path.join(temporaryDirectory, `merge-${pass}-${batchNumber}.jsonl`);
  await mergeRunBatch(runPaths, outputPath);
  await Promise.all(runPaths.map((runPath) => rm(runPath)));
  return outputPath;
};

const mergeRunPass = async (
  runPaths: string[],
  temporaryDirectory: string,
  pass: number,
): Promise<string[]> => {
  const mergedRunPaths: string[] = [];
  let batch: string[] = [];

  for (const runPath of runPaths) {
    batch.push(runPath);
    if (batch.length < MAX_MERGE_FAN_IN) {
      continue;
    }

    // Intercala os lotes em sequência para limitar os arquivos abertos e o espaço temporário.
    // eslint-disable-next-line no-await-in-loop
    const mergedPath = await mergeRunBatchToPath(
      batch,
      temporaryDirectory,
      pass,
      mergedRunPaths.length,
    );
    mergedRunPaths.push(mergedPath);
    batch = [];
  }

  if (batch.length > 0) {
    // eslint-disable-next-line no-await-in-loop
    const mergedPath = await mergeRunBatchToPath(
      batch,
      temporaryDirectory,
      pass,
      mergedRunPaths.length,
    );
    mergedRunPaths.push(mergedPath);
  }

  return mergedRunPaths;
};

export const groupByExternalTimestampSort = async function* groupByExternalTimestampSort(
  people: AsyncIterable<MonitoredPerson>,
  options: ExternalSortOptions = {},
): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError("External sort chunkSize must be a positive safe integer");
  }

  const temporaryDirectory = await mkdtemp(
    path.join(options.temporaryDirectory ?? tmpdir(), "spacecom-timestamp-sort-"),
  );

  try {
    let runPaths: string[] = [];
    let chunk: SortRecord[] = [];
    let sequence = 0;

    // Ordena blocos menores no disco para não guardar todo o dataset na memória.
    for await (const person of people) {
      chunk.push({ person, sequence });
      sequence += 1;

      if (chunk.length >= chunkSize) {
        const runPath = path.join(temporaryDirectory, `run-${runPaths.length}.jsonl`);
        // Grava cada bloco antes de continuar para manter a memória limitada.
        // eslint-disable-next-line no-await-in-loop
        await writeSortedRun(chunk, runPath);
        runPaths.push(runPath);
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      const runPath = path.join(temporaryDirectory, `run-${runPaths.length}.jsonl`);
      await writeSortedRun(chunk, runPath);
      runPaths.push(runPath);
    }

    // Divide a intercalação em etapas para limitar arquivos abertos e espaço temporário.
    let pass = 0;
    while (runPaths.length > MAX_MERGE_FAN_IN) {
      // Cada passada depende dos arquivos concluídos na passada anterior.
      // eslint-disable-next-line no-await-in-loop
      runPaths = await mergeRunPass(runPaths, temporaryDirectory, pass);
      pass += 1;
    }

    let currentTimestamp: Timestamp | undefined;
    let currentGroup: MonitoredPerson[] = [];

    // A intercalação mantém apenas um registro de cada bloco na memória.
    for await (const { person } of mergeRuns(runPaths)) {
      if (currentTimestamp !== undefined && person.timestamp !== currentTimestamp) {
        yield [currentTimestamp, currentGroup];
        currentGroup = [];
      }

      currentTimestamp = person.timestamp;
      currentGroup.push(person);
    }

    if (currentTimestamp !== undefined) {
      yield [currentTimestamp, currentGroup];
    }
  } finally {
    // Os arquivos temporários são removidos mesmo se a leitura ou o consumidor falhar.
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};
