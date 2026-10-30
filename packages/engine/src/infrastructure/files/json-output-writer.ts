import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Encounter } from "../../domain.js";

export const writeJsonOutput = async (filePath: string, encounters: Encounter[]): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(encounters, null, 2)}\n`, "utf-8");
};
