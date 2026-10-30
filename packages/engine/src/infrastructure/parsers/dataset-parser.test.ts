import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readDatasetFile } from "../files/file-dataset-reader.js";
import { parseDataset } from "./dataset-parser.js";

const INPUTS_DIRECTORY = new URL("../../../../../datasets/inputs/", import.meta.url);
const EXPECTED_RECORD_COUNTS = new Map([
  ["dataset1.txt", 5000],
  ["dataset2.txt", 25_000],
  ["dataset3.txt", 100_000],
  ["dataset4.txt", 400_020],
  ["dataset5.txt", 1_000_000],
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

  it("parses every dataset currently available in datasets/inputs", async () => {
    const directoryEntries = await readdir(INPUTS_DIRECTORY);
    const files = directoryEntries.filter((fileName) => fileName.endsWith(".txt")).toSorted();

    expect(files.length).toBeGreaterThan(0);

    for (const fileName of files) {
      const inputPath = fileURLToPath(new URL(fileName, INPUTS_DIRECTORY));
      // Parse sequentially so the million-row datasets do not overlap in memory.
      // eslint-disable-next-line no-await-in-loop
      const people = await readDatasetFile(inputPath);

      expect(people.length, fileName).toBeGreaterThan(0);

      const expectedRecordCount = EXPECTED_RECORD_COUNTS.get(fileName);
      if (expectedRecordCount !== undefined) {
        expect(people.length, fileName).toBe(expectedRecordCount);
      }
    }
  });
});
