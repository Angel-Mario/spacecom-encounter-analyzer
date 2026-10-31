import path from "node:path";

import {
  formatDatasetSummary,
  getDefaultOutputPath,
  listDatasetFiles,
  processDataset,
  resolveWorkspacePath,
} from "./application.js";
import type { UnsortedStrategy } from "./application.js";
import { ENV } from "./env.js";

// Opções internas derivadas do parsing dos argumentos da linha de comando.
interface CliOptions {
  command: "process" | "process-all" | "benchmark" | "help";
  datasetPath?: string;
  inputDirectory: string;
  outputDirectory: string;
  unsortedStrategy: UnsortedStrategy;
}

const DEFAULT_INPUT_DIRECTORY = path.join("datasets", "inputs");
const DEFAULT_OUTPUT_DIRECTORY = path.join("datasets", "outputs");

const parseUnsortedStrategy = (value: string): UnsortedStrategy => {
  if (value === "prompt" || value === "external" || value === "cancel") {
    return value;
  }

  throw new Error(`Invalid unsorted strategy "${value}". Use prompt, external, or cancel.`);
};

const readOptionValue = (args: string[], index: number, option: string): string => {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Option ${option} requires a value.`);
  }

  return value;
};

const isCommand = (value: string): value is CliOptions["command"] =>
  value === "process" || value === "process-all" || value === "benchmark";

// Analisa os argumentos da linha de comando e retorna as opções da CLI.
// Lança Error se um comando ou opção desconhecida for fornecida.
export const parseArguments = (args: string[]): CliOptions => {
  const [commandArgument, ...remainingArguments] = args;
  if (!commandArgument || commandArgument === "--help" || commandArgument === "-h") {
    return {
      command: "help",
      inputDirectory: ENV.SPACECOM_INPUT_DIR ?? DEFAULT_INPUT_DIRECTORY,
      outputDirectory: ENV.SPACECOM_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIRECTORY,
      unsortedStrategy: ENV.SPACECOM_UNSORTED_STRATEGY ?? "prompt",
    };
  }

  if (!isCommand(commandArgument)) {
    throw new Error(`Unknown command "${commandArgument}". Run with --help for usage.`);
  }

  let datasetPath: string | undefined;
  let inputDirectory = ENV.SPACECOM_INPUT_DIR ?? DEFAULT_INPUT_DIRECTORY;
  let outputDirectory = ENV.SPACECOM_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIRECTORY;
  let unsortedStrategy = ENV.SPACECOM_UNSORTED_STRATEGY ?? "prompt";
  let outputOptionProvided = false;

  for (let index = 0; index < remainingArguments.length; index += 1) {
    const argument = remainingArguments[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--input" || argument === "--output" || argument === "--unsorted") {
      const optionValue = readOptionValue(remainingArguments, index, argument);
      if (argument === "--input") {
        inputDirectory = optionValue;
      } else if (argument === "--output") {
        outputDirectory = optionValue;
        outputOptionProvided = true;
      } else {
        unsortedStrategy = parseUnsortedStrategy(optionValue);
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown option "${argument}".`);
    }

    if (commandArgument === "process" && datasetPath === undefined) {
      datasetPath = argument;
    } else {
      throw new Error(`Unexpected argument "${argument}".`);
    }
  }

  if (commandArgument === "process" && !datasetPath) {
    throw new Error("The process command requires a dataset file path.");
  }

  if (commandArgument === "benchmark" && outputOptionProvided) {
    throw new Error("The benchmark command does not write output files; remove --output.");
  }

  const parsedOptions: CliOptions = {
    command: commandArgument,
    inputDirectory,
    outputDirectory,
    unsortedStrategy,
  };

  if (datasetPath !== undefined) {
    parsedOptions.datasetPath = datasetPath;
  }

  return parsedOptions;
};

export const HELP_TEXT = `Spacecom Encounter Analyzer

Usage:
  pnpm start -- process <dataset.txt> [--output <directory>] [--unsorted <prompt|external|cancel>]
  pnpm start -- process-all [--input <directory>] [--output <directory>] [--unsorted <prompt|external|cancel>]
  pnpm start -- benchmark [--input <directory>] [--unsorted <prompt|external|cancel>]

Commands:
  process       Process one dataset and write its encounter JSON.
  process-all   Process all .txt datasets in the input directory.
  benchmark     Process each dataset and print execution and memory metrics without writing JSON.

Options:
  --input       Input directory for process-all and benchmark (default: SPACECOM_INPUT_DIR or datasets/inputs).
  --output      Output directory (default: SPACECOM_OUTPUT_DIR or datasets/outputs).
  --unsorted    Fallback behavior: prompt, external, or cancel (default: SPACECOM_UNSORTED_STRATEGY or prompt).
  --help        Show this help message.

Environment:
  Defaults are set in .env.schema at the repository root and can be overridden
  with a git-ignored .env file or shell exports. Values are validated by
  varlock on startup:
  SPACECOM_INPUT_DIR, SPACECOM_OUTPUT_DIR, SPACECOM_UNSORTED_STRATEGY.`;

const throwMissingDatasetPath = (): never => {
  throw new Error("The process command requires a dataset file path.");
};

// Executa o comando solicitado: process, process-all, benchmark ou help.
// Processa os datasets em sequência para que as métricas de cada um sejam precisas.
export const runCommand = async (args: string[]): Promise<void> => {
  const options = parseArguments(args);
  if (options.command === "help") {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const files =
    options.command === "process"
      ? [resolveWorkspacePath(options.datasetPath ?? throwMissingDatasetPath())]
      : await listDatasetFiles(resolveWorkspacePath(options.inputDirectory));

  for (const datasetPath of files) {
    const outputPath =
      options.command === "benchmark"
        ? undefined
        : getDefaultOutputPath(datasetPath, resolveWorkspacePath(options.outputDirectory));
    const processOptions =
      outputPath === undefined
        ? { unsortedStrategy: options.unsortedStrategy }
        : { outputPath, unsortedStrategy: options.unsortedStrategy };
    // O benchmark roda em sequência para deixar cada medição associada ao seu dataset.
    // eslint-disable-next-line no-await-in-loop
    const summary = await processDataset(datasetPath, processOptions);
    process.stdout.write(`${formatDatasetSummary(summary)}\n\n`);
  }
};
