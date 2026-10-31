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
const NAIVE_PAIR_THRESHOLD = 40;

// Great-circle distance d and the 3-D chord c between two points on the sphere
// satisfy d = 2·R·asin(c / (2·R)). Floating-point noise is bounded by ~1e-8 m,
// so pairs beyond the verify band skip the haversine formula, and pairs inside
// the band still get the exact decision that the haversine comparison gives.
const CHORD_LIMIT_METERS =
  2 *
  EARTH_RADIUS_METERS *
  Math.sin(MAX_ENCOUNTER_DISTANCE_METERS / (2 * EARTH_RADIUS_METERS));
const CHORD_VERIFY_SQUARED_METERS = (CHORD_LIMIT_METERS + 1e-3) ** 2;

type TimestampGroup = readonly [Timestamp, readonly MonitoredPerson[]];
type TimestampGroups = AsyncIterable<TimestampGroup> | Iterable<TimestampGroup>;

const pairKey = (firstId: number, secondId: number): string =>
  firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;

interface SpatialEntry {
  cellX: number;
  cellY: number;
  cellZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  index: number;
}

const getSpatialEntry = (
  person: MonitoredPerson,
  index: number
): SpatialEntry => {
  const latitude = (person.latitude * Math.PI) / 180;
  const longitude = (person.longitude * Math.PI) / 180;
  const latitudeRadius = EARTH_RADIUS_METERS * Math.cos(latitude);
  const positionX = latitudeRadius * Math.cos(longitude);
  const positionY = latitudeRadius * Math.sin(longitude);
  const positionZ = EARTH_RADIUS_METERS * Math.sin(latitude);

  // A pair within 20 m has Cartesian coordinate differences below the 25 m cell size.
  return {
    cellX: Math.floor(positionX / SPATIAL_CELL_SIZE_METERS),
    cellY: Math.floor(positionY / SPATIAL_CELL_SIZE_METERS),
    cellZ: Math.floor(positionZ / SPATIAL_CELL_SIZE_METERS),
    index,
    positionX,
    positionY,
    positionZ,
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
            // Duplicate detections from hash collisions stay safe: the pair
            // key set discards repeated encounters.
            candidateIndexes.push(candidate.index);
          }
        }
      }
    }
  }
};

const considerEncounter = (
  first: MonitoredPerson,
  firstEntry: SpatialEntry,
  second: MonitoredPerson,
  secondEntry: SpatialEntry,
  detectedPairs: Set<string>
): number | undefined => {
  if (first.id === second.id) {
    return undefined;
  }

  const key = pairKey(first.id, second.id);
  if (detectedPairs.has(key)) {
    return undefined;
  }

  const positionDifferenceX = secondEntry.positionX - firstEntry.positionX;
  const positionDifferenceY = secondEntry.positionY - firstEntry.positionY;
  const positionDifferenceZ = secondEntry.positionZ - firstEntry.positionZ;
  const squaredChord =
    positionDifferenceX * positionDifferenceX +
    positionDifferenceY * positionDifferenceY +
    positionDifferenceZ * positionDifferenceZ;

  if (squaredChord > CHORD_VERIFY_SQUARED_METERS) {
    return undefined;
  }

  const distanciaMetros = calculateDistanceMeters(
    { lat: first.latitude, lon: first.longitude },
    { lat: second.latitude, lon: second.longitude }
  );

  if (distanciaMetros >= MAX_ENCOUNTER_DISTANCE_METERS) {
    return undefined;
  }

  detectedPairs.add(key);
  return distanciaMetros;
};

const validateGroupTimestamps = (
  timestamp: Timestamp,
  people: readonly MonitoredPerson[]
): void => {
  for (const person of people) {
    if (person.timestamp !== timestamp) {
      throw new Error(
        `Timestamp group "${timestamp}" contains a record from "${person.timestamp}"`
      );
    }
  }
};

export const detectEncountersInGroup = function* detectEncountersInGroup(
  timestamp: Timestamp,
  people: readonly MonitoredPerson[]
): Generator<EncounterCandidate> {
  validateGroupTimestamps(timestamp, people);
  if (people.length < 2) {
    return;
  }

  const detectedPairs = new Set<string>();
  const spatialEntries = people.map(getSpatialEntry);

  // Naive pairwise checking beats the 27-neighbor-cell bookkeeping below for
  // small groups.
  if (people.length < NAIVE_PAIR_THRESHOLD) {
    for (let firstIndex = 0; firstIndex < people.length; firstIndex += 1) {
      const first = people[firstIndex];
      const firstEntry = spatialEntries[firstIndex];
      if (!first || !firstEntry) {
        continue;
      }

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < people.length;
        secondIndex += 1
      ) {
        const second = people[secondIndex];
        const secondEntry = spatialEntries[secondIndex];
        if (!second || !secondEntry) {
          continue;
        }

        const distanciaMetros = considerEncounter(
          first,
          firstEntry,
          second,
          secondEntry,
          detectedPairs
        );
        if (distanciaMetros !== undefined) {
          yield { distanciaMetros, participants: [first, second], timestamp };
        }
      }
    }

    return;
  }

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

  for (
    let firstIndex = 0;
    firstIndex < spatialEntries.length;
    firstIndex += 1
  ) {
    const firstEntry = spatialEntries[firstIndex];
    const first = people[firstIndex];
    if (!firstEntry || !first) {
      continue;
    }

    candidateIndexes.length = 0;

    findCandidateIndexes(firstEntry, spatialIndex, candidateIndexes);

    // Single candidates need no ordering; larger lists sort to keep the same
    // encounter order as the previous baseline (ascending pair indexes).
    if (candidateIndexes.length > 1) {
      candidateIndexes.sort(
        (firstCandidateIndex, secondCandidateIndex) =>
          firstCandidateIndex - secondCandidateIndex
      );
    }

    // Duplicate indexes from hash collisions are harmless: considerEncounter
    // discards repeated pairs.
    for (const secondIndex of candidateIndexes) {
      const second = people[secondIndex];
      const secondEntry = spatialEntries[secondIndex];
      if (!second || !secondEntry) {
        continue;
      }

      const distanciaMetros = considerEncounter(
        first,
        firstEntry,
        second,
        secondEntry,
        detectedPairs
      );
      if (distanciaMetros !== undefined) {
        yield { distanciaMetros, participants: [first, second], timestamp };
      }
    }
  }
};

export const detectEncounters = async function* detectEncounters(
  groups: TimestampGroups
): AsyncGenerator<EncounterCandidate> {
  for await (const [timestamp, people] of groups) {
    yield* detectEncountersInGroup(timestamp, people);
  }
};
