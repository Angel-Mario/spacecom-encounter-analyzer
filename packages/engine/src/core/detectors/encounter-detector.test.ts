import { describe, expect, it } from "vitest";

import type { EncounterCandidate, MonitoredPerson } from "../../domain.js";
import {
  calculateDistanceMeters,
  EARTH_RADIUS_METERS,
} from "../algorithms/haversine.js";
import {
  detectEncounters,
  MAX_ENCOUNTER_DISTANCE_METERS,
} from "./encounter-detector.js";

const createPerson = (
  id: number,
  timestamp: string,
  latitude: number,
  longitude: number
): MonitoredPerson => ({
  factionId: null,
  hasProtectiveMeasure: false,
  id,
  latitude,
  longitude,
  restrictedIds: [],
  timestamp,
});

const collectEncounters = async (
  groups: Iterable<readonly [string, readonly MonitoredPerson[]]>
): Promise<EncounterCandidate[]> => {
  const encounters: EncounterCandidate[] = [];

  for await (const encounter of detectEncounters(groups)) {
    encounters.push(encounter);
  }

  return encounters;
};

const collectEncountersWithoutIndex = (
  timestamp: string,
  people: readonly MonitoredPerson[]
): EncounterCandidate[] => {
  const encounters: EncounterCandidate[] = [];
  const detectedPairs = new Set<string>();

  for (let firstIndex = 0; firstIndex < people.length; firstIndex += 1) {
    const first = people[firstIndex];
    if (!first) {
      continue;
    }

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < people.length;
      secondIndex += 1
    ) {
      const second = people[secondIndex];
      if (!second || first.id === second.id) {
        continue;
      }

      const key =
        first.id < second.id
          ? `${first.id}:${second.id}`
          : `${second.id}:${first.id}`;
      if (detectedPairs.has(key)) {
        continue;
      }

      const distanciaMetros = calculateDistanceMeters(
        { lat: first.latitude, lon: first.longitude },
        { lat: second.latitude, lon: second.longitude }
      );
      if (distanciaMetros < MAX_ENCOUNTER_DISTANCE_METERS) {
        detectedPairs.add(key);
        encounters.push({
          distanciaMetros,
          participants: [first, second],
          timestamp,
        });
      }
    }
  }

  return encounters;
};

describe("detectEncounters", () => {
  it("detects pairs closer than 20 meters and includes their timestamp and distance", async () => {
    const first = createPerson(4, "2026-10-30 18:00:00", -10.07996, -37.08384);
    const second = createPerson(6, "2026-10-30 18:00:00", -10.07987, -37.08389);

    const encounters = await collectEncounters([
      [first.timestamp, [first, second]],
    ]);

    expect(encounters).toEqual([
      {
        distanciaMetros: expect.closeTo(11.406788673336607, 10),
        participants: [first, second],
        timestamp: first.timestamp,
      },
    ]);
  });

  it("does not detect pairs at the distance limit or farther away", async () => {
    const first = createPerson(1, "2026-10-30 18:00:00", 0, 0);
    const exactlyAtLimit = createPerson(
      2,
      first.timestamp,
      0,
      (MAX_ENCOUNTER_DISTANCE_METERS / EARTH_RADIUS_METERS) * (180 / Math.PI)
    );
    const fartherAway = createPerson(3, first.timestamp, 0, -0.0002);

    expect(
      calculateDistanceMeters(
        { lat: first.latitude, lon: first.longitude },
        { lat: exactlyAtLimit.latitude, lon: exactlyAtLimit.longitude }
      )
    ).toBeCloseTo(MAX_ENCOUNTER_DISTANCE_METERS, 10);

    const encounters = await collectEncounters([
      [first.timestamp, [first, exactlyAtLimit, fartherAway]],
    ]);

    expect(encounters).toEqual([]);
  });

  it("examines each pair once and does not report duplicate monitored IDs", async () => {
    const firstPosition = createPerson(1, "2026-10-30 18:00:00", 0, 0);
    const duplicatePosition = createPerson(
      1,
      firstPosition.timestamp,
      0,
      0.00001
    );
    const other = createPerson(2, firstPosition.timestamp, 0, 0.00002);

    const encounters = await collectEncounters([
      [firstPosition.timestamp, [firstPosition, duplicatePosition, other]],
    ]);

    expect(encounters).toHaveLength(1);
    expect(encounters[0]?.participants.map(({ id }) => id)).toEqual([1, 2]);
  });

  it("does not compare positions from different timestamp groups", async () => {
    const first = createPerson(1, "2026-10-30 18:00:00", 0, 0);
    const second = createPerson(2, "2026-10-30 18:00:05", 0, 0);

    const encounters = await collectEncounters([
      [first.timestamp, [first]],
      [second.timestamp, [second]],
    ]);

    expect(encounters).toEqual([]);
  });

  it("rejects a group containing a record with a different timestamp", async () => {
    const first = createPerson(1, "2026-10-30 18:00:00", 0, 0);
    const second = createPerson(2, "2026-10-30 18:00:05", 0, 0);

    await expect(
      collectEncounters([[first.timestamp, [first, second]]])
    ).rejects.toThrow(
      'Timestamp group "2026-10-30 18:00:00" contains a record from "2026-10-30 18:00:05"'
    );
  });

  it("returns no encounters when a timestamp has fewer than two records", async () => {
    const person = createPerson(1, "2026-10-30 18:00:00", 0, 0);

    await expect(
      collectEncounters([[person.timestamp, [person]]])
    ).resolves.toEqual([]);
  });

  it("matches exhaustive detection for nearby points across global coordinates", async () => {
    const timestamp = "2026-10-30 18:00:00";
    const people = [
      createPerson(1, timestamp, 0, 179.99999),
      createPerson(2, timestamp, 0, -179.99999),
      createPerson(3, timestamp, 89.9999, 0),
      createPerson(4, timestamp, 89.9999, 0.0001),
      ...Array.from({ length: 100 }, (_, index) => {
        const latitude = -80 + ((index * 37) % 160);
        const longitude = -180 + ((index * 71) % 360);
        const offset = index % 2 === 0 ? 0.00005 : -0.00005;
        return createPerson(index + 5, timestamp, latitude, longitude + offset);
      }),
    ];

    await expect(collectEncounters([[timestamp, people]])).resolves.toEqual(
      collectEncountersWithoutIndex(timestamp, people)
    );
  });
});
