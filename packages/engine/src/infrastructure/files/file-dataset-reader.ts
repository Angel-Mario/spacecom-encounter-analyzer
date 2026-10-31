import { groupSortedByTimestamp } from "../../core/grouping/timestamp-grouper.js";
import type { MonitoredPerson, Timestamp } from "../../domain.js";
import {
  parseDatasetHeader,
  parseDatasetRow,
} from "../parsers/dataset-parser.js";
import { readLines } from "./dataset-line-reader.js";
import { groupByExternalTimestampSort } from "./external-timestamp-sorter.js";
import type { ExternalSortOptions } from "./external-timestamp-sorter.js";

export const readDatasetRecords = async function* readDatasetRecords(
  filePath: string
): AsyncGenerator<MonitoredPerson> {
  // A leitura por linha evita carregar o arquivo inteiro antes de começar o processamento.
  const lines = readLines(filePath);
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
