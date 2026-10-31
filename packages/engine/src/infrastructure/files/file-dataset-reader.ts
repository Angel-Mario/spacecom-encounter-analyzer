import { createReadStream } from "node:fs";

import { groupSortedByTimestamp } from "../../core/grouping/timestamp-grouper.js";
import type { MonitoredPerson, Timestamp } from "../../domain.js";
import {
  parseDatasetHeader,
  parseDatasetRow,
} from "../parsers/dataset-parser.js";
import { groupByExternalTimestampSort } from "./external-timestamp-sorter.js";
import type { ExternalSortOptions } from "./external-timestamp-sorter.js";

const NEWLINE_BYTE = 10;
const STREAM_CHUNK_BYTES = 262_144;

// Manual newline splitting avoids the per-line queue and promises of the
// readline interface; chunks keep only the bytes of the current partial line.
const readRawLines = async function* readRawLines(
  filePath: string
): AsyncGenerator<string> {
  const input = createReadStream(filePath, {
    highWaterMark: STREAM_CHUNK_BYTES,
  });

  try {
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    for await (const chunk of input) {
      const bufferChunk = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as string);
      pending =
        pending.length === 0
          ? bufferChunk
          : Buffer.concat([pending, bufferChunk]);

      let newlineIndex = pending.indexOf(NEWLINE_BYTE);
      while (newlineIndex >= 0) {
        const line = pending.subarray(0, newlineIndex).toString("utf-8");
        pending = pending.subarray(newlineIndex + 1);
        newlineIndex = pending.indexOf(NEWLINE_BYTE);
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }

    if (pending.length > 0) {
      const line = pending.toString("utf-8");
      yield line.endsWith("\r") ? line.slice(0, -1) : line;
    }
  } finally {
    // Node destroys the stream when the generator closes before completion.
    input.destroy();
  }
};

export const readDatasetRecords = async function* readDatasetRecords(
  filePath: string
): AsyncGenerator<MonitoredPerson> {
  // A leitura por linha evita carregar o arquivo inteiro antes de começar o processamento.
  const lines = readRawLines(filePath);
  let lineNumber = 0;
  let hasHeader = false;

  for await (const line of lines) {
    lineNumber += 1;
    if (!hasHeader) {
      // Valida o cabeçalho uma única vez antes de interpretar os registros.
      parseDatasetHeader(line);
      hasHeader = true;
      continue;
    }

    const person = parseDatasetRow(line, lineNumber);
    if (person) {
      yield person;
    }
  }

  if (!hasHeader) {
    throw new Error("Dataset is empty");
  }
};

export const readDatasetFile = async (
  filePath: string
): Promise<MonitoredPerson[]> => {
  // Esta opção é conveniente para datasets pequenos, mas mantém todos os registros na memória.
  const people: MonitoredPerson[] = [];

  for await (const person of readDatasetRecords(filePath)) {
    people.push(person);
  }

  return people;
};

export const readDatasetGroups = async function* readDatasetGroups(
  filePath: string
): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
  // Use esta rota quando os registros já estiverem ordenados por timestamp.
  yield* groupSortedByTimestamp(readDatasetRecords(filePath));
};

export const readDatasetGroupsWithExternalSort =
  async function* readDatasetGroupsWithExternalSort(
    filePath: string,
    options?: ExternalSortOptions
  ): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
    // O ordenamento externo permite agrupar arquivos grandes mesmo quando os timestamps estão fora de ordem.
    yield* groupByExternalTimestampSort(readDatasetRecords(filePath), options);
  };
