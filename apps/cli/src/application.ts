import { readdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline/promises";

import {
  classifyEncounter,
  detectEncountersInGroup,
  readDatasetGroups,
  readDatasetGroupsWithExternalSort,
  UnsortedTimestampsError,
  writeJsonOutput,
} from "@spacecom-encounter-analyzer/engine";
import type {
  Encounter,
  MonitoredPerson,
  Timestamp,
} from "@spacecom-encounter-analyzer/engine";

export type UnsortedStrategy = "prompt" | "external" | "cancel";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface DatasetSummary {
  datasetPath: string;
  outputPath?: string;
  records: number;
  timestamps: number;
  encounters: Encounter[];
  elapsedSeconds: number;
  heapUsedMegabytes: number;
  rssMegabytes: number;
}

interface ProcessOptions {
  outputPath?: string;
  unsortedStrategy: UnsortedStrategy;
  prompt?: (message: string) => Promise<boolean>;
}

interface ProcessingResult {
  encounters: Encounter[];
  records: number;
  timestamps: number;
}

const collectResults = async (
  groups: AsyncIterable<readonly [Timestamp, readonly MonitoredPerson[]]>
): Promise<ProcessingResult> => {
  const result: ProcessingResult = {
    encounters: [],
    records: 0,
    timestamps: 0,
  };

  for await (const [timestamp, people] of groups) {
    result.records += people.length;
    result.timestamps += 1;

    // The per-group generator avoids one async machinery per timestamp group.
    for (const candidate of detectEncountersInGroup(timestamp, people)) {
      result.encounters.push(classifyEncounter(candidate));
    }
  }

  return result;
};

const defaultPrompt = async (message: string): Promise<boolean> => {
  if (!process.stdin.isTTY) {
    throw new Error(
      "The dataset has unordered timestamps. Use --unsorted external to enable disk-backed sorting."
    );
  }

  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await terminal.question(`${message} [y/N] `);
    return (
      answer.trim().toLowerCase() === "y" ||
      answer.trim().toLowerCase() === "yes"
    );
  } finally {
    terminal.close();
  }
};

const collectWithFallback = async (
  datasetPath: string,
  strategy: UnsortedStrategy,
  prompt: (message: string) => Promise<boolean>
): Promise<ProcessingResult> => {
  if (strategy === "external") {
    return collectResults(readDatasetGroupsWithExternalSort(datasetPath));
  }

  try {
    return await collectResults(readDatasetGroups(datasetPath));
  } catch (error) {
    if (!(error instanceof UnsortedTimestampsError)) {
      throw error;
    }

    if (strategy === "cancel") {
      throw new Error(
        `Dataset timestamps are out of order at record ${error.recordNumber}; processing cancelled.`,
        { cause: error }
      );
    }

    const shouldContinue = await prompt(
      `Timestamps are out of order at record ${error.recordNumber}. Retry using disk-backed external sorting?`
    );
    if (!shouldContinue) {
      throw new Error(
        "Processing cancelled because timestamps are out of order.",
        {
          cause: error,
        }
      );
    }

    // Reabre o arquivo e descarta qualquer resultado parcial da tentativa em streaming.
    return collectResults(readDatasetGroupsWithExternalSort(datasetPath));
  }
};

export const processDataset = async (
  datasetPath: string,
  options: ProcessOptions
): Promise<DatasetSummary> => {
  const start = performance.now();
  const prompt = options.prompt ?? defaultPrompt;
  const result = await collectWithFallback(
    datasetPath,
    options.unsortedStrategy,
    prompt
  );

  if (options.outputPath) {
    await writeJsonOutput(options.outputPath, result.encounters);
  }

  const memory = process.memoryUsage();
  const summary: DatasetSummary = {
    datasetPath,
    elapsedSeconds: (performance.now() - start) / 1000,
    encounters: result.encounters,
    heapUsedMegabytes: memory.heapUsed / 1024 / 1024,
    records: result.records,
    rssMegabytes: memory.rss / 1024 / 1024,
    timestamps: result.timestamps,
  };

  if (options.outputPath) {
    summary.outputPath = options.outputPath;
  }

  return summary;
};

export const listDatasetFiles = async (
  inputDirectory: string
): Promise<string[]> => {
  const directoryEntries = await readdir(inputDirectory, {
    withFileTypes: true,
  });
  const files = directoryEntries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt")
    )
    .map((entry) => path.join(inputDirectory, entry.name))
    .toSorted((first, second) => first.localeCompare(second));

  if (files.length === 0) {
    throw new Error(`No .txt datasets found in "${inputDirectory}"`);
  }

  return files;
};

export const resolveWorkspacePath = (filePath: string): string =>
  path.isAbsolute(filePath) ? filePath : path.resolve(WORKSPACE_ROOT, filePath);

export const getDefaultOutputPath = (
  datasetPath: string,
  outputDirectory: string
): string => {
  const datasetName = path.basename(datasetPath, path.extname(datasetPath));
  const datasetNumber = /^dataset(?<number>\d+)$/iu.exec(datasetName)?.groups
    ?.number;
  const outputName = datasetNumber
    ? `respostas${datasetNumber}.json`
    : `${datasetName}.json`;
  return path.join(outputDirectory, outputName);
};

export const formatDatasetSummary = (summary: DatasetSummary): string => {
  const counts = {
    faccao: summary.encounters.filter(
      (encounter) => encounter.tipo === "faccao"
    ).length,
    generico: summary.encounters.filter(
      (encounter) => encounter.tipo === "generico"
    ).length,
    protetiva: summary.encounters.filter(
      (encounter) => encounter.tipo === "protetiva"
    ).length,
  };
  const number = new Intl.NumberFormat("en-US");
  const lines = [
    "SPACECOM ENCOUNTER ANALYZER",
    "────────────────────────────────────",
    "",
    `Dataset: ${path.basename(summary.datasetPath)}`,
    "",
    `Records processed:       ${number.format(summary.records)}`,
    `Unique timestamps:       ${number.format(summary.timestamps)}`,
    "",
    `Encounters detected:     ${number.format(summary.encounters.length)}`,
    "",
    `Generic encounters:      ${number.format(counts.generico)}`,
    `Faction encounters:      ${number.format(counts.faccao)}`,
    `Protective encounters:   ${number.format(counts.protetiva)}`,
    "",
    `Execution time:          ${summary.elapsedSeconds.toFixed(2)} s`,
    `Heap used:               ${summary.heapUsedMegabytes.toFixed(1)} MB`,
    `Memory (RSS):            ${summary.rssMegabytes.toFixed(1)} MB`,
  ];

  if (summary.outputPath) {
    lines.push("", `Output: ${summary.outputPath}`);
  }

  lines.push("", "Status: SUCCESS");
  return lines.join("\n");
};
