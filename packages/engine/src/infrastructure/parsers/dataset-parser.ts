import { z } from "zod";

import type { MonitoredPerson, Timestamp } from "../../domain.js";

export const DATASET_HEADERS = [
  "idMonitorado",
  "faccaoMonitorado",
  "timestamp",
  "latitude",
  "longitude",
  "medidaProtetiva",
  "idsRestricaoMedida",
] as const;

const INTEGER_PATTERN = /^-?\d+$/u;
const COORDINATE_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;

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

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${field}${issue.message}`;
    })
    .join("; ");

export const parseDataset = (content: string): MonitoredPerson[] => {
  const [headerLine, ...recordLines] = content.split(/\r?\n/u);

  if (headerLine === undefined) {
    throw new Error("Dataset is empty");
  }

  const [firstHeader, ...remainingHeaders] = parseDelimitedRecord(headerLine, 1);
  const header = [firstHeader?.replace(/^\uFEFF/u, "") ?? "", ...remainingHeaders];
  const parsedHeader = DatasetHeadersSchema.safeParse(header);

  if (!parsedHeader.success) {
    throw new Error(`Invalid dataset header: expected ${DATASET_HEADERS.join(";")}`, {
      cause: parsedHeader.error,
    });
  }

  const people: MonitoredPerson[] = [];

  for (const [index, line] of recordLines.entries()) {
    const lineNumber = index + 2;
    if (line.trim() === "") {
      continue;
    }

    const fields = parseDelimitedRecord(line, lineNumber);
    if (fields.length !== DATASET_HEADERS.length) {
      throw new Error(
        `Invalid dataset row ${lineNumber}: expected ${DATASET_HEADERS.length} fields, received ${fields.length}`,
      );
    }

    const [
      idMonitorado,
      faccaoMonitorado,
      timestamp,
      latitude,
      longitude,
      medidaProtetiva,
      idsRestricaoMedida,
    ] = fields;
    const parsedRecord = DatasetRowSchema.safeParse({
      faccaoMonitorado,
      idMonitorado,
      idsRestricaoMedida,
      latitude,
      longitude,
      medidaProtetiva,
      timestamp,
    });

    if (!parsedRecord.success) {
      throw new Error(`Invalid dataset row ${lineNumber}: ${describeIssues(parsedRecord.error)}`, {
        cause: parsedRecord.error,
      });
    }

    people.push(parsedRecord.data);
  }

  return people;
};
