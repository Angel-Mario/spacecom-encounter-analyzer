import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getDefaultOutputPath, listDatasetFiles, processDataset } from "./application.js";
import { parseArguments } from "./commands.js";

const header =
  "idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida";

describe("CLI arguments and processing", () => {
  it("parses process and fallback options", () => {
    expect(
      parseArguments(["process", "input.txt", "--output", "results", "--unsorted", "external"]),
    ).toMatchObject({
      command: "process",
      datasetPath: "input.txt",
      outputDirectory: "results",
      unsortedStrategy: "external",
    });
  });

  it("rejects a process command without an input file", () => {
    expect(() => parseArguments(["process"])).toThrow(/requires a dataset file/u);
  });

  it("uses the expected output filename for numbered datasets", () => {
    expect(getDefaultOutputPath("datasets/inputs/dataset3.txt", "results")).toBe(
      path.join("results", "respostas3.json"),
    );
  });

  it("lists text datasets in a stable order", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "spacecom-cli-test-"));

    try {
      await writeFile(path.join(directory, "dataset2.txt"), "input");
      await writeFile(path.join(directory, "dataset1.txt"), "input");
      await writeFile(path.join(directory, "notes.md"), "ignore");

      expect(await listDatasetFiles(directory)).toEqual([
        path.join(directory, "dataset1.txt"),
        path.join(directory, "dataset2.txt"),
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("processes a dataset and writes the expected encounter JSON", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "spacecom-cli-test-"));
    const inputPath = path.join(directory, "dataset1.txt");
    const outputPath = path.join(directory, "outputs", "respostas1.json");

    try {
      await writeFile(
        inputPath,
        `${header}\n1;2;"2026-10-30 18:00:00";-23.55000;-46.63000;false;\n2;2;"2026-10-30 18:00:00";-23.55001;-46.63000;false;\n`,
      );

      const summary = await processDataset(inputPath, {
        outputPath,
        unsortedStrategy: "cancel",
      });

      expect(summary.records).toBe(2);
      expect(summary.timestamps).toBe(1);
      expect(summary.encounters).toHaveLength(1);
      expect(summary.encounters[0]?.tipo).toBe("faccao");
      const output = await readFile(outputPath, "utf-8");
      expect(JSON.parse(output)).toEqual(summary.encounters);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("retries an unsorted dataset with external sorting and discards partial results", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "spacecom-cli-test-"));
    const inputPath = path.join(directory, "unsorted.txt");

    try {
      await writeFile(
        inputPath,
        `${header}\n1;;"2026-10-30 18:00:05";-23.55000;-46.63000;false;\n2;;"2026-10-30 18:00:05";-23.55001;-46.63000;false;\n3;;"2026-10-30 18:00:00";-23.55000;-46.63000;false;\n4;;"2026-10-30 18:00:00";-23.55001;-46.63000;false;\n`,
      );
      let promptCount = 0;

      const summary = await processDataset(inputPath, {
        prompt: () => {
          promptCount += 1;
          return Promise.resolve(true);
        },
        unsortedStrategy: "prompt",
      });

      expect(promptCount).toBe(1);
      expect(summary.records).toBe(4);
      expect(summary.timestamps).toBe(2);
      expect(summary.encounters).toHaveLength(2);
      expect(summary.encounters.map(({ timestamp }) => timestamp)).toEqual([
        "2026-10-30 18:00:00",
        "2026-10-30 18:00:05",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
