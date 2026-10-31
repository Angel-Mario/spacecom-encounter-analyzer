import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readDatasetGroups } from "../files/file-dataset-reader.js";
import { parseDataset } from "./dataset-parser.js";

const INPUTS_DIRECTORY = new URL("../../../../../datasets/inputs/", import.meta.url);
const EXPECTED_DATASET_COUNTS = new Map([
  ["dataset1.txt", { records: 5000, timestamps: 500 }],
  ["dataset2.txt", { records: 25_000, timestamps: 1250 }],
  ["dataset3.txt", { records: 100_000, timestamps: 2500 }],
  ["dataset4.txt", { records: 400_020, timestamps: 6667 }],
  ["dataset5.txt", { records: 1_000_000, timestamps: 12_500 }],
]);

const VALID_HEADER =
  "idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida";

describe("parseDataset", () => {
  it("parses quoted values and converts each field to its domain type", () => {
    const dataset = `${VALID_HEADER}\n7;3;"2026-10-30 18:00:00";-23.55052;-46.63331;true;"1,2"`;

    expect(parseDataset(dataset)).toEqual([
      {
        factionId: 3,
        hasProtectiveMeasure: true,
        id: 7,
        latitude: -23.55052,
        longitude: -46.63331,
        restrictedIds: [1, 2],
        timestamp: "2026-10-30 18:00:00",
      },
    ]);
  });

  it("rejects invalid fields with the dataset row number", () => {
    const dataset = `${VALID_HEADER}\n7;;"2026-02-30 18:00:00";;-46.63331;false;`;

    expect(() => parseDataset(dataset)).toThrow(/dataset row 2/u);
  });

  it("rejects malformed quoted fields", () => {
    const dataset = `${VALID_HEADER}\n7;;"2026-10-30 18:00:00;-23.55052;-46.63331;false;`;

    expect(() => parseDataset(dataset)).toThrow(/unclosed quoted field/iu);
  });

  it("streams and groups every dataset currently available in datasets/inputs", async () => {
    const directoryEntries = await readdir(INPUTS_DIRECTORY);
    const files = directoryEntries.filter((fileName) => fileName.endsWith(".txt")).toSorted();

    expect(files.length).toBeGreaterThan(0);

    for (const fileName of files) {
      const inputPath = fileURLToPath(new URL(fileName, INPUTS_DIRECTORY));
      let recordCount = 0;
      let timestampCount = 0;
      let previousTimestamp: string | undefined;

      // Processa um dataset por vez para manter o uso de memória limitado.
      // eslint-disable-next-line no-await-in-loop
      for await (const [timestamp, people] of readDatasetGroups(inputPath)) {
        expect(timestamp >= (previousTimestamp ?? timestamp), fileName).toBe(true);
        expect(
          people.every((person) => person.timestamp === timestamp),
          fileName,
        ).toBe(true);
        recordCount += people.length;
        timestampCount += 1;
        previousTimestamp = timestamp;
      }

      expect(recordCount, fileName).toBeGreaterThan(0);

      const expectedCounts = EXPECTED_DATASET_COUNTS.get(fileName);
      if (expectedCounts !== undefined) {
        expect(recordCount, fileName).toBe(expectedCounts.records);
        expect(timestampCount, fileName).toBe(expectedCounts.timestamps);
      }
    }
  });
});
