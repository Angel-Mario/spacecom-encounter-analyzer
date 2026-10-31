import { describe, expect, it } from "vitest";

import type { MonitoredPerson } from "../../domain.js";
import {
  groupSortedByTimestamp,
  groupUnsortedByTimestamp,
  UnsortedTimestampsError,
} from "./timestamp-grouper.js";

const createPerson = (id: number, timestamp: string): MonitoredPerson => ({
  factionId: null,
  hasProtectiveMeasure: false,
  id,
  latitude: -23.55,
  longitude: -46.63,
  restrictedIds: [],
  timestamp,
});

const collectGroups = async (
  people: Iterable<MonitoredPerson>,
): Promise<[string, MonitoredPerson[]][]> => {
  const groups: [string, MonitoredPerson[]][] = [];

  for await (const group of groupSortedByTimestamp(people)) {
    groups.push(group);
  }

  return groups;
};

describe("groupSortedByTimestamp", () => {
  it("groups people only when their timestamps match exactly", async () => {
    const first = createPerson(1, "2026-10-30 18:00:00");
    const second = createPerson(2, "2026-10-30 18:00:00");
    const nextPosition = createPerson(3, "2026-10-30 18:00:05");

    const groups = await collectGroups([first, second, nextPosition]);

    expect(groups).toEqual([
      ["2026-10-30 18:00:00", [first, second]],
      ["2026-10-30 18:00:05", [nextPosition]],
    ]);
  });

  it("preserves input order within each timestamp group", async () => {
    const laterId = createPerson(9, "2026-10-30 18:00:00");
    const earlierId = createPerson(1, "2026-10-30 18:00:00");
    const otherTimestamp = createPerson(2, "2026-10-30 18:00:05");

    const groups = await collectGroups([laterId, earlierId, otherTimestamp]);

    expect(groups[0]).toEqual(["2026-10-30 18:00:00", [laterId, earlierId]]);
  });

  it("returns no groups for an empty dataset", async () => {
    expect(await collectGroups([])).toEqual([]);
  });

  it("rejects records that are out of timestamp order", async () => {
    const people = [createPerson(1, "2026-10-30 18:00:05"), createPerson(2, "2026-10-30 18:00:00")];
    const error = await collectGroups(people).catch((error_: unknown) => error_);

    expect(error).toBeInstanceOf(UnsortedTimestampsError);
    expect(error).toMatchObject({
      currentTimestamp: "2026-10-30 18:00:00",
      previousTimestamp: "2026-10-30 18:00:05",
      recordNumber: 2,
    });
  });

  it("groups out-of-order records using the in-memory fallback", async () => {
    const first = createPerson(1, "2026-10-30 18:00:05");
    const second = createPerson(2, "2026-10-30 18:00:00");
    const third = createPerson(3, "2026-10-30 18:00:05");

    const groups = await groupUnsortedByTimestamp([first, second, third]);

    expect(groups).toEqual(
      new Map([
        ["2026-10-30 18:00:05", [first, third]],
        ["2026-10-30 18:00:00", [second]],
      ]),
    );
  });
});
