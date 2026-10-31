import { z } from "zod";

import type { MonitoredPerson, Timestamp } from "../../domain.js";

// Cabeçalho esperado pelo desafio: sete colunas separadas por ponto e vírgula.
export const DATASET_HEADERS = [
  "idMonitorado",
  "faccaoMonitorado",
  "timestamp",
  "latitude",
  "longitude",
  "medidaProtetiva",
  "idsRestricaoMedida",
] as const;

// Padrões de validação usados tanto no caminho Zod quanto no caminho otimizado.
const INTEGER_PATTERN = /^-?\d+$/u;
const COORDINATE_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;

// Máximo de dias por mês (fevereiro é tratado separadamente para anos bissextos).
const DAYS_IN_MONTH = [31, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 28];

// O cache evita reexecutar a regex e a verificação de calendário para timestamps repetidos
// (a maioria dos timestamps num dataset real aparece muitas vezes).
const TIMESTAMP_CACHE_SIZE_LIMIT = 1_000_000;
const validTimestampCache = new Set<string>();

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const maximumDayOfMonth = (year: number, month: number): number => {
  if (month !== 2) {
    return DAYS_IN_MONTH[month - 1] ?? 0;
  }

  return isLeapYear(year) ? 29 : 28;
};

// Valida o texto do timestamp verificando mês, dia e hora sem criar um objeto Date
// (muito mais rápido para datasets com milhões de linhas).
const isValidTimestampText = (value: string): boolean => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > maximumDayOfMonth(year, month)) {
    return false;
  }

  return hour <= 23 && minute <= 59 && second <= 59;
};

const isValidTimestamp = (value: string): boolean => {
  // Timestamps verificados dominam os datasets reais; o cache evita tanto a
  // regex quanto as verificações de calendário para valores repetidos.
  if (validTimestampCache.has(value)) {
    return true;
  }

  if (!TIMESTAMP_PATTERN.test(value) || !isValidTimestampText(value)) {
    return false;
  }

  if (validTimestampCache.size < TIMESTAMP_CACHE_SIZE_LIMIT) {
    validTimestampCache.add(value);
  }

  return true;
};

// ── Schemas Zod usados pela API pública (parseDataset) ─────────────────────

const integerSchema = z
  .string()
  .regex(INTEGER_PATTERN, "Must be an integer")
  .transform(Number)
  .pipe(z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER));

const factionSchema = z
  .union([z.literal(""), integerSchema])
  .transform((value) => (value === "" ? null : value));

const timestampSchema = z
  .string()
  .regex(TIMESTAMP_PATTERN, "Must use the format YYYY-MM-DD HH:MM:SS")
  .refine((value) => {
    const date = new Date(`${value.replace(" ", "T")}Z`);
    return (
      Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19).replace("T", " ") === value
    );
  }, "Must be a valid date and time")
  .transform((value): Timestamp => value);

const coordinateSchema = (minimum: number, maximum: number) =>
  z
    .string()
    .regex(COORDINATE_PATTERN, "Must be a decimal number")
    .transform(Number)
    .pipe(z.number().min(minimum).max(maximum));

const protectiveMeasureSchema = z.enum(["true", "false"]).transform((value) => value === "true");

const restrictedIdsSchema = z
  .string()
  .transform((value) => (value === "" ? [] : value.split(",").map((id) => id.trim())))
  .pipe(z.array(integerSchema));

export const DatasetHeadersSchema = z.tuple([
  z.literal(DATASET_HEADERS[0]),
  z.literal(DATASET_HEADERS[1]),
  z.literal(DATASET_HEADERS[2]),
  z.literal(DATASET_HEADERS[3]),
  z.literal(DATASET_HEADERS[4]),
  z.literal(DATASET_HEADERS[5]),
  z.literal(DATASET_HEADERS[6]),
]);

export const DatasetRowSchema = z
  .object({
    faccaoMonitorado: factionSchema,
    idMonitorado: integerSchema,
    idsRestricaoMedida: restrictedIdsSchema,
    latitude: coordinateSchema(-90, 90),
    longitude: coordinateSchema(-180, 180),
    medidaProtetiva: protectiveMeasureSchema,
    timestamp: timestampSchema,
  })
  .transform(
    ({
      faccaoMonitorado,
      idMonitorado,
      idsRestricaoMedida,
      latitude,
      longitude,
      medidaProtetiva,
      timestamp,
    }): MonitoredPerson => ({
      factionId: faccaoMonitorado,
      hasProtectiveMeasure: medidaProtetiva,
      id: idMonitorado,
      latitude,
      longitude,
      restrictedIds: idsRestricaoMedida,
      timestamp,
    }),
  );

// Analisa uma linha no formato CSV delimitado por ponto e vírgula, com suporte a campos entre aspas.
const parseDelimitedRecord = (line: string, lineNumber: number): string[] => {
  const fields: string[] = [];
  let field = "";
  let insideQuotes = false;
  let closedQuotedField = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === undefined) {
      continue;
    }

    if (insideQuotes) {
      if (character === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
        closedQuotedField = true;
      } else {
        field += character;
      }

      continue;
    }

    if (character === ";") {
      fields.push(field.trim());
      field = "";
      closedQuotedField = false;
      continue;
    }

    if (closedQuotedField) {
      if (character.trim() !== "") {
        throw new Error(`Invalid CSV quoting on dataset row ${lineNumber}`);
      }

      continue;
    }

    if (character === '"') {
      if (field.trim() !== "") {
        throw new Error(`Invalid CSV quoting on dataset row ${lineNumber}`);
      }

      field = "";
      insideQuotes = true;
      continue;
    }

    field += character;
  }

  if (insideQuotes) {
    throw new Error(`Unclosed quoted field on dataset row ${lineNumber}`);
  }

  fields.push(field.trim());
  return fields;
};

const describeIssues = (issues: readonly string[]): string => issues.join("; ");

const SAFE_INTEGER_MINIMUM = Number.MIN_SAFE_INTEGER;
const SAFE_INTEGER_MAXIMUM = Number.MAX_SAFE_INTEGER;

// Analisa um campo inteiro e acumula erros no array `issues` em vez de lançar exceção,
// permitindo relatar todos os problemas de uma linha em uma única mensagem.
const requireIntegerField = (
  field: string | undefined,
  label: string,
  issues: string[],
): number => {
  if (field === undefined || !INTEGER_PATTERN.test(field)) {
    issues.push(`${label}: Must be an integer`);
    return Number.NaN;
  }

  const parsed = Number(field);
  if (!Number.isSafeInteger(parsed)) {
    issues.push(
      `${label}: expected integer between ${SAFE_INTEGER_MINIMUM} and ${SAFE_INTEGER_MAXIMUM}`,
    );
    return Number.NaN;
  }

  return parsed;
};

const requireCoordinateField = (
  field: string | undefined,
  minimum: number,
  maximum: number,
  label: string,
  issues: string[],
): number => {
  if (field === undefined || !COORDINATE_PATTERN.test(field)) {
    issues.push(`${label}: Must be a decimal number`);
    return Number.NaN;
  }

  const parsed = Number(field);
  if (parsed < minimum || parsed > maximum) {
    issues.push(`${label}: expected number between ${minimum} and ${maximum}`);
  }

  return parsed;
};

const requireProtectiveMeasureField = (field: string | undefined, issues: string[]): boolean => {
  if (field === "true") {
    return true;
  }

  if (field === "false") {
    return false;
  }

  issues.push(`medidaProtetiva: expected "true" or "false"`);
  return false;
};

const requireTimestampField = (field: string | undefined, issues: string[]): Timestamp => {
  if (field !== undefined && isValidTimestamp(field)) {
    return field;
  }

  if (field === undefined || !TIMESTAMP_PATTERN.test(field)) {
    issues.push("timestamp: Must use the format YYYY-MM-DD HH:MM:SS");
    return field ?? "";
  }

  issues.push("timestamp: Must be a valid date and time");
  return field;
};

const parseRestrictedIdsField = (field: string | undefined, issues: string[]): number[] => {
  if (field === undefined || field === "") {
    return [];
  }

  const parts = field.split(",");
  const ids: number[] = [];

  for (const [index, part] of parts.entries()) {
    const parsed = requireIntegerField(part.trim(), `idsRestricaoMedida.${index}`, issues);
    if (Number.isSafeInteger(parsed)) {
      ids.push(parsed);
    }
  }

  return ids;
};

const isBlankLine = (line: string): boolean => {
  for (const character of line) {
    if (character.trim() !== "") {
      return false;
    }
  }

  return true;
};

// Valida a linha de cabeçalho do dataset; lança Error se as colunas não corresponderem ao esperado.
// Remove o BOM (U+FEFF) que alguns editores inserem no início do arquivo.
export const parseDatasetHeader = (line: string): void => {
  const [firstHeader, ...remainingHeaders] = parseDelimitedRecord(line, 1);
  const header = [firstHeader?.replace(/^\uFEFF/u, "") ?? "", ...remainingHeaders];
  const parsedHeader = DatasetHeadersSchema.safeParse(header);

  if (!parsedHeader.success) {
    throw new Error(`Invalid dataset header: expected ${DATASET_HEADERS.join(";")}`, {
      cause: parsedHeader.error,
    });
  }
};

// Analisa uma linha de dados e retorna um MonitoredPerson, ou undefined para linhas em branco.
// Lança Error se o número de campos ou algum valor for inválido.
export const parseDatasetRow = (line: string, lineNumber: number): MonitoredPerson | undefined => {
  if (isBlankLine(line)) {
    return undefined;
  }

  const fields = parseDelimitedRecord(line, lineNumber);
  if (fields.length !== DATASET_HEADERS.length) {
    throw new Error(
      `Invalid dataset row ${lineNumber}: expected ${DATASET_HEADERS.length} fields, received ${fields.length}`,
    );
  }

  // The length check above keeps every destructured field defined.
  const [
    idMonitorado,
    faccaoMonitorado,
    timestamp,
    latitude,
    longitude,
    medidaProtetiva,
    idsRestricaoMedida,
  ] = fields;

  const issues: string[] = [];
  const factionId =
    faccaoMonitorado === ""
      ? null
      : requireIntegerField(faccaoMonitorado, "faccaoMonitorado", issues);
  const id = requireIntegerField(idMonitorado, "idMonitorado", issues);
  const restrictedIds = parseRestrictedIdsField(idsRestricaoMedida, issues);
  const parsedLatitude = requireCoordinateField(latitude, -90, 90, "latitude", issues);
  const parsedLongitude = requireCoordinateField(longitude, -180, 180, "longitude", issues);
  const hasProtectiveMeasure = requireProtectiveMeasureField(medidaProtetiva, issues);
  const parsedTimestamp = requireTimestampField(timestamp, issues);

  if (issues.length > 0) {
    throw new Error(`Invalid dataset row ${lineNumber}: ${describeIssues(issues)}`);
  }

  return {
    factionId,
    hasProtectiveMeasure,
    id,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    restrictedIds,
    timestamp: parsedTimestamp,
  };
};

// Analisa um dataset completo a partir de uma string (usado para datasets pequenos em memória).
export const parseDataset = (content: string): MonitoredPerson[] => {
  const [headerLine, ...recordLines] = content.split(/\r?\n/u);

  if (headerLine === undefined) {
    throw new Error("Dataset is empty");
  }

  parseDatasetHeader(headerLine);

  const people: MonitoredPerson[] = [];

  for (const [index, line] of recordLines.entries()) {
    const person = parseDatasetRow(line, index + 2);
    if (person) {
      people.push(person);
    }
  }

  return people;
};
