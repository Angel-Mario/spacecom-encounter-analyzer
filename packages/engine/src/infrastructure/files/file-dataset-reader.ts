import { readFile } from "node:fs/promises";

import type { MonitoredPerson } from "../../domain.js";
import { parseDataset } from "../parsers/dataset-parser.js";

export const readDatasetFile = async (filePath: string): Promise<MonitoredPerson[]> => {
  const content = await readFile(filePath, "utf-8");
  return parseDataset(content);
};
