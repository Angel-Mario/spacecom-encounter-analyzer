import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyEncounter } from "../../core/classifiers/encounter-classifier.js";
import { detectEncountersInGroup } from "../../core/detectors/encounter-detector.js";
import { UnsortedTimestampsError } from "../../core/grouping/timestamp-grouper.js";
import { readDatasetGroups } from "./file-dataset-reader.js";
import { analyzeDatasetParallel } from "./parallel-dataset-processor.js";
import type { ParallelDatasetAnalysis } from "./parallel-dataset-processor.js";

const HEADER =
  "idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida";

interface PlannedGroup {
  records: number;
  timestamp: string;
}

const row = (index: number, timestamp: string): string =>
  `${String(index).padStart(3, "0")};;"${timestamp}";-23.55000;-46.63000;false;`;

const buildDataset = (groups: PlannedGroup[]): string => {
  const lines = [HEADER];
  for (const group of groups) {
    for (let index = 0; index < group.records; index += 1) {
      lines.push(row(index, group.timestamp));
    }
  }

  return `${lines.join("\n")}\n`;
};

const serialReference = async (
  filePath: string
): Promise<ParallelDatasetAnalysis> => {
  const reference: ParallelDatasetAnalysis = {
    encounters: [],
    records: 0,
    timestamps: 0,
  };
  for await (const [timestamp, people] of readDatasetGroups(filePath)) {
    reference.records += people.length;
    reference.timestamps += 1;
    for (const candidate of detectEncountersInGroup(timestamp, people)) {
      reference.encounters.push(classifyEncounter(candidate));
    }
  }

  return reference;
};

const withTemporaryDataset = async (
  content: string,
  run: (inputPath: string) => Promise<void>
): Promise<void> => {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "spacecom-parallel-test-")
  );

  try {
    const inputPath = path.join(temporaryDirectory, "input.txt");
    await writeFile(inputPath, content, "utf-8");
    await run(inputPath);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};

describe("analyzeDatasetParallel", () => {
  it("matches the serial detector when timestamp groups span chunk boundaries", async () => {
    await withTemporaryDataset(
      buildDataset([
        { records: 25, timestamp: "2026-10-30 18:00:00" },
        { records: 15, timestamp: "2026-10-30 18:00:05" },
        { records: 60, timestamp: "2026-10-30 18:00:10" },
        { records: 5, timestamp: "2026-10-30 18:00:15" },
      ]),
      async (inputPath) => {
        const parallel = await analyzeDatasetParallel(inputPath, {
          chunkBytes: 256,
        });
        const reference = await serialReference(inputPath);

        // Cada grupo está co-locado, então o grupo de 60 registros sozinho
        // vira 1770 encontros distribuídos ao longo de muitos chunks: a
        // comparação prova que o merge e o relay mantêm os encontros em
        // ordem exata.
        expect(parallel.timestamps).toBe(4);
        expect(parallel.records).toBe(105);
        expect(parallel.encounters).toHaveLength(2185);
        expect(parallel).toEqual(reference);
      }
    );
  });

  it("keeps serial record numbering when the dataset is out of order", async () => {
    await withTemporaryDataset(
      buildDataset([
        { records: 10, timestamp: "2026-10-30 18:00:10" },
        { records: 12, timestamp: "2026-10-30 18:00:00" },
      ]),
      async (inputPath) => {
        // Com linhas de row de 54 bytes, o corte planejado cai depois do
        // registro 5 e depois do registro 11 na numeração serial, de modo
        // que a queda de ordem recai exatamente sobre o registro 11, como
        // o caminho serial indica.
        const failure = await analyzeDatasetParallel(inputPath, {
          chunkBytes: 256,
        }).then(
          () => null,
          (error: unknown) => error
        );

        expect(failure).toBeInstanceOf(UnsortedTimestampsError);
        expect(
          failure instanceof Error &&
            /"2026-10-30 18:00:00" follows "2026-10-30 18:00:10" at record 11/u.test(
              failure.message
            )
        ).toBe(true);
      }
    );
  });

  it("serializes datasets that are too small to split", async () => {
    await withTemporaryDataset(
      buildDataset([{ records: 3, timestamp: "2026-10-30 18:00:00" }]),
      async (inputPath) => {
        const parallel = await analyzeDatasetParallel(inputPath);
        const reference = await serialReference(inputPath);

        expect(parallel.timestamps).toBe(1);
        expect(parallel.records).toBe(3);
        expect(parallel.encounters).toHaveLength(3);
        expect(parallel).toEqual(reference);
      }
    );
  });

  it("matches the serial detector when blank lines cross chunk boundaries", async () => {
    await withTemporaryDataset(
      [
        HEADER,
        "",
        row(0, "2026-10-30 18:00:00"),
        "",
        row(1, "2026-10-30 18:00:00"),
        row(2, "2026-10-30 18:00:00"),
        "",
        row(0, "2026-10-30 18:00:05"),
        "",
        row(1, "2026-10-30 18:00:10"),
        row(2, "2026-10-30 18:00:10"),
        "",
      ].join("\n"),
      async (inputPath) => {
        const parallel = await analyzeDatasetParallel(inputPath, {
          chunkBytes: 128,
        });
        const reference = await serialReference(inputPath);

        expect(parallel.timestamps).toBe(3);
        expect(parallel.records).toBe(6);
        expect(parallel.encounters).toHaveLength(4);
        expect(parallel).toEqual(reference);
      }
    );
  });
});
