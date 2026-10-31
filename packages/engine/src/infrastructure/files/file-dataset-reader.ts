import { groupSortedByTimestamp } from "../../core/grouping/timestamp-grouper.js";
import type { MonitoredPerson, Timestamp } from "../../domain.js";
import { parseDatasetHeader, parseDatasetRow } from "../parsers/dataset-parser.js";
import { readLines } from "./dataset-line-reader.js";
import { groupByExternalTimestampSort } from "./external-timestamp-sorter.js";
import type { ExternalSortOptions } from "./external-timestamp-sorter.js";

// Lê o arquivo linha a linha e emite um MonitoredPerson por registro válido.
// A leitura em stream evita carregar o arquivo inteiro antes de começar o processamento.
export const readDatasetRecords = async function* readDatasetRecords(
  filePath: string,
): AsyncGenerator<MonitoredPerson> {
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

// Lê todos os registros do arquivo e retorna um array em memória.
// Conveniente para datasets pequenos; para datasets grandes prefira readDatasetRecords
// ou readDatasetGroups para evitar excesso de uso de memória.
export const readDatasetFile = async (filePath: string): Promise<MonitoredPerson[]> => {
  const people: MonitoredPerson[] = [];

  for await (const person of readDatasetRecords(filePath)) {
    people.push(person);
  }

  return people;
};

// Lê e agrupa os registros por timestamp, assumindo que o arquivo já está ordenado.
// Lança UnsortedTimestampsError se a ordem crescente de timestamps for violada.
// Use esta rota quando os registros já estiverem ordenados por timestamp.
export const readDatasetGroups = async function* readDatasetGroups(
  filePath: string,
): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
  yield* groupSortedByTimestamp(readDatasetRecords(filePath));
};

// Lê e agrupa os registros por timestamp usando ordenação externa em disco,
// suportando arquivos grandes com timestamps fora de ordem sem carregar tudo na memória.
export const readDatasetGroupsWithExternalSort = async function* readDatasetGroupsWithExternalSort(
  filePath: string,
  options?: ExternalSortOptions,
): AsyncGenerator<[Timestamp, MonitoredPerson[]]> {
  yield* groupByExternalTimestampSort(readDatasetRecords(filePath), options);
};
