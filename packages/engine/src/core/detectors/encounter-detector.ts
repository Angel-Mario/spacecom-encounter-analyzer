import type {
  EncounterCandidate,
  MonitoredPerson,
  Timestamp,
} from "../../domain.js";
import {
  calculateDistanceMeters,
  EARTH_RADIUS_METERS,
} from "../algorithms/haversine.js";

export const MAX_ENCOUNTER_DISTANCE_METERS = 20;

const SPATIAL_CELL_SIZE_METERS = 25;
const CELL_HASH_MODULUS = 4_294_967_291;
const CELL_HASH_MULTIPLIER = 1_000_003;

type TimestampGroup = readonly [Timestamp, readonly MonitoredPerson[]];
type TimestampGroups = AsyncIterable<TimestampGroup> | Iterable<TimestampGroup>;

const pairKey = (firstId: number, secondId: number): string =>
  firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;

interface SpatialEntry {
  cellX: number;
  cellY: number;
  cellZ: number;
  index: number;
}

const getSpatialEntry = (
  person: MonitoredPerson,
  index: number
): SpatialEntry => {
  const latitude = (person.latitude * Math.PI) / 180;
  const longitude = (person.longitude * Math.PI) / 180;
  const latitudeRadius = EARTH_RADIUS_METERS * Math.cos(latitude);

  // A pair within 20 m has Cartesian coordinate differences below the 25 m cell size.
  return {
    cellX: Math.floor(
      (latitudeRadius * Math.cos(longitude)) / SPATIAL_CELL_SIZE_METERS
    ),
    cellY: Math.floor(
      (latitudeRadius * Math.sin(longitude)) / SPATIAL_CELL_SIZE_METERS
    ),
    cellZ: Math.floor(
      (EARTH_RADIUS_METERS * Math.sin(latitude)) / SPATIAL_CELL_SIZE_METERS
    ),
    index,
  };
};

const hashCell = (cellX: number, cellY: number, cellZ: number): number => {
  let hash =
    ((cellX % CELL_HASH_MODULUS) + CELL_HASH_MODULUS) % CELL_HASH_MODULUS;
  hash = (hash * CELL_HASH_MULTIPLIER + cellY) % CELL_HASH_MODULUS;
  return (hash * CELL_HASH_MULTIPLIER + cellZ) % CELL_HASH_MODULUS;
};

const findCandidateIndexes = (
  firstEntry: SpatialEntry,
  spatialIndex: Map<number, SpatialEntry[]>,
  candidateIndexes: number[]
): void => {
  // Hash collisions only add work; exact cell checks discard non-neighboring candidates.
  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        const bucket = spatialIndex.get(
          hashCell(
            firstEntry.cellX + offsetX,
            firstEntry.cellY + offsetY,
            firstEntry.cellZ + offsetZ
          )
        );
        if (!bucket) {
          continue;
        }

        for (const candidate of bucket) {
          if (
            candidate.index > firstEntry.index &&
            Math.abs(candidate.cellX - firstEntry.cellX) <= 1 &&
            Math.abs(candidate.cellY - firstEntry.cellY) <= 1 &&
            Math.abs(candidate.cellZ - firstEntry.cellZ) <= 1
          ) {
            candidateIndexes.push(candidate.index);
          }
        }
      }
    }
  }
};

export const detectEncounters = async function* detectEncounters(
  groups: TimestampGroups
): AsyncGenerator<EncounterCandidate> {
  for await (const [timestamp, people] of groups) {
    const detectedPairs = new Set<string>();
    const spatialEntries = people.map(getSpatialEntry);
    const spatialIndex = new Map<number, SpatialEntry[]>();

    for (const entry of spatialEntries) {
      const key = hashCell(entry.cellX, entry.cellY, entry.cellZ);
      const bucket = spatialIndex.get(key);
      if (bucket) {
        bucket.push(entry);
      } else {
        spatialIndex.set(key, [entry]);
      }
    }

    const candidateIndexes: number[] = [];

    for (const firstEntry of spatialEntries) {
      const firstIndex = firstEntry.index;
      const first = people[firstIndex];
      if (!first) {
        continue;
      }

      if (first.timestamp !== timestamp) {
        throw new Error(
          `Timestamp group "${timestamp}" contains a record from "${first.timestamp}"`
        );
      }

      candidateIndexes.length = 0;

      findCandidateIndexes(firstEntry, spatialIndex, candidateIndexes);

      candidateIndexes.sort(
        (firstCandidateIndex, secondCandidateIndex) =>
          firstCandidateIndex - secondCandidateIndex
      );

      let previousCandidateIndex = -1;
      for (const secondIndex of candidateIndexes) {
        if (secondIndex === previousCandidateIndex) {
          continue;
        }
        previousCandidateIndex = secondIndex;

        const second = people[secondIndex];
        if (!second) {
          continue;
        }

        if (second.timestamp !== timestamp) {
          throw new Error(
            `Timestamp group "${timestamp}" contains a record from "${second.timestamp}"`
          );
        }

        if (first.id === second.id) {
          continue;
        }

        const key = pairKey(first.id, second.id);
        if (detectedPairs.has(key)) {
          continue;
        }

        const distanciaMetros = calculateDistanceMeters(
          { lat: first.latitude, lon: first.longitude },
          { lat: second.latitude, lon: second.longitude }
        );

        if (distanciaMetros < MAX_ENCOUNTER_DISTANCE_METERS) {
          detectedPairs.add(key);
          yield { distanciaMetros, participants: [first, second], timestamp };
        }
      }
    }
  }
};
