export type {
  Coordinates,
  Encounter,
  EncounterType,
  MonitoredPerson,
  Timestamp,
} from "./domain.js";
export { readDatasetFile } from "./infrastructure/files/file-dataset-reader.js";
export { writeJsonOutput } from "./infrastructure/files/json-output-writer.js";
export {
  DATASET_HEADERS,
  DatasetHeadersSchema,
  DatasetRowSchema,
  parseDataset,
} from "./infrastructure/parsers/dataset-parser.js";
