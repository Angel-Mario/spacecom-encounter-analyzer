import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MonitoredPerson } from "../../domain.js";
import { groupByExternalTimestampSort } from "./external-timestamp-sorter.js";
import { readDatasetGroupsWithExternalSort } from "./file-dataset-reader.js";

const createPerson = (id: number, timestamp: string): MonitoredPerson => ({
  factionId: null,
  hasProtectiveMeasure: false,
  id,
  latitude: -23.55,
  longitude: -46.63,
  restrictedIds: [],
  timestamp,
});

const asAsyncIterable = async function* asAsyncIterable(
  people: MonitoredPerson[],
): AsyncGenerator<MonitoredPerson> {
  yield* people;
};

const failingInput = async function* failingInput(): AsyncGenerator<MonitoredPerson> {
  yield createPerson(1, "2026-10-30 18:00:00");
  throw new Error("Input stream failed");
};

const collectGroups = async (
  people: AsyncIterable<MonitoredPerson>,
  options: { chunkSize: number; temporaryDirectory: string },
): Promise<[string, MonitoredPerson[]][]> => {
  const groups: [string, MonitoredPerson[]][] = [];

  for await (const group of groupByExternalTimestampSort(people, options)) {
    groups.push(group);
  }

  return groups;
};

describe("groupByExternalTimestampSort", () => {
  it("sorts unordered records and merges equal timestamps across runs", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));

    try {
      const groups = await collectGroups(
        asAsyncIterable([
          createPerson(1, "2026-10-30 18:00:05"),
          createPerson(2, "2026-10-30 18:00:00"),
          createPerson(3, "2026-10-30 18:00:05"),
          createPerson(4, "2026-10-30 18:00:10"),
          createPerson(5, "2026-10-30 18:00:00"),
        ]),
        { chunkSize: 2, temporaryDirectory },
      );

      expect(groups).toEqual([
        [
          "2026-10-30 18:00:00",
          [createPerson(2, "2026-10-30 18:00:00"), createPerson(5, "2026-10-30 18:00:00")],
        ],
        [
          "2026-10-30 18:00:05",
          [createPerson(1, "2026-10-30 18:00:05"), createPerson(3, "2026-10-30 18:00:05")],
        ],
        ["2026-10-30 18:00:10", [createPerson(4, "2026-10-30 18:00:10")]],
      ]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("merges multiple bounded batches for inputs with many sort runs", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));
    const people = Array.from({ length: 70 }, (_, index) => {
      const minutesFromStart = 69 - index;
      const hour = String(Math.floor(minutesFromStart / 60)).padStart(2, "0");
      const minute = String(minutesFromStart % 60).padStart(2, "0");
      return createPerson(index, `2026-10-30 ${hour}:${minute}:00`);
    });

    try {
      const groups = await collectGroups(asAsyncIterable(people), {
        chunkSize: 1,
        temporaryDirectory,
      });

      expect(groups).toHaveLength(70);
      expect(groups[0]?.[0]).toBe("2026-10-30 00:00:00");
      expect(groups.at(-1)?.[0]).toBe("2026-10-30 01:09:00");
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("reads and externally sorts an unordered dataset file", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));
    const inputPath = path.join(temporaryDirectory, "input.txt");
    const header =
      "idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida";
    await writeFile(
      inputPath,
      `${header}\n1;;"2026-10-30 18:00:05";-23.55000;-46.63000;false;\n2;;"2026-10-30 18:00:00";-23.55000;-46.63000;false;\n`,
      "utf-8",
    );

    try {
      const groups: [string, MonitoredPerson[]][] = [];
      for await (const group of readDatasetGroupsWithExternalSort(inputPath, {
        chunkSize: 1,
        temporaryDirectory,
      })) {
        groups.push(group);
      }

      expect(groups.map(([timestamp]) => timestamp)).toEqual([
        "2026-10-30 18:00:00",
        "2026-10-30 18:00:05",
      ]);
      expect(await readdir(temporaryDirectory)).toEqual(["input.txt"]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("removes temporary files after successful grouping", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));

    try {
      await collectGroups(asAsyncIterable([createPerson(1, "2026-10-30 18:00:00")]), {
        chunkSize: 1,
        temporaryDirectory,
      });

      expect(await readdir(temporaryDirectory)).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("removes temporary files when the consumer stops early", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));

    try {
      const iterator = groupByExternalTimestampSort(
        asAsyncIterable([
          createPerson(1, "2026-10-30 18:00:00"),
          createPerson(2, "2026-10-30 18:00:05"),
        ]),
        { chunkSize: 1, temporaryDirectory },
      );
      for await (const [timestamp] of iterator) {
        expect(timestamp).toBe("2026-10-30 18:00:00");
        if (timestamp === "2026-10-30 18:00:00") {
          break;
        }
      }

      expect(await readdir(temporaryDirectory)).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("removes temporary files when the input stream fails", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "spacecom-sort-test-"));

    try {
      await expect(
        collectGroups(failingInput(), { chunkSize: 1, temporaryDirectory }),
      ).rejects.toThrow("Input stream failed");

      expect(await readdir(temporaryDirectory)).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("rejects a non-positive chunk size", async () => {
    await expect(
      collectGroups(asAsyncIterable([]), {
        chunkSize: 0,
        temporaryDirectory: tmpdir(),
      }),
    ).rejects.toThrow(/chunkSize/u);
  });
});
