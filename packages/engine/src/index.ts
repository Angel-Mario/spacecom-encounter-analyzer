export type {
  Coordinates,
  Encounter,
  EncounterCandidate,
  EncounterType,
  MonitoredPerson,
  Timestamp,
} from "./domain.js";
export {
  calculateDistanceMeters,
  EARTH_RADIUS_METERS,
} from "./core/algorithms/haversine.js";
export { classifyEncounter } from "./core/classifiers/encounter-classifier.js";
export {
  detectEncounters,
  detectEncountersInGroup,
  MAX_ENCOUNTER_DISTANCE_METERS,
} from "./core/detectors/encounter-detector.js";
export {
  groupSortedByTimestamp,
  groupUnsortedByTimestamp,
  UnsortedTimestampsError,
} from "./core/grouping/timestamp-grouper.js";
export {
  readDatasetFile,
  readDatasetGroups,
  readDatasetGroupsWithExternalSort,
  readDatasetRecords,
} from "./infrastructure/files/file-dataset-reader.js";
export { analyzeDatasetParallel } from "./infrastructure/files/parallel-dataset-processor.js";
export type {
  ParallelDatasetAnalysis,
  ParallelDatasetOptions,
} from "./infrastructure/files/parallel-dataset-processor.js";
export type { ExternalSortOptions } from "./infrastructure/files/external-timestamp-sorter.js";
export { writeJsonOutput } from "./infrastructure/files/json-output-writer.js";
export {
  DATASET_HEADERS,
  DatasetHeadersSchema,
  DatasetRowSchema,
  parseDataset,
} from "./infrastructure/parsers/dataset-parser.js";
