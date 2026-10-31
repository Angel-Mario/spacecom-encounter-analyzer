import type { EncounterCandidate, MonitoredPerson, Timestamp } from "../../domain.js";
import { calculateDistanceMeters } from "../algorithms/haversine.js";

export const MAX_ENCOUNTER_DISTANCE_METERS = 20;

type TimestampGroup = readonly [Timestamp, readonly MonitoredPerson[]];
type TimestampGroups = AsyncIterable<TimestampGroup> | Iterable<TimestampGroup>;

const pairKey = (firstId: number, secondId: number): string =>
  firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;

export const detectEncounters = async function* detectEncounters(
  groups: TimestampGroups,
): AsyncGenerator<EncounterCandidate> {
  for await (const [timestamp, people] of groups) {
    const detectedPairs = new Set<string>();

    // O segundo índice começa após o primeiro para avaliar cada par apenas uma vez.
    for (let firstIndex = 0; firstIndex < people.length; firstIndex += 1) {
      const first = people[firstIndex];
      if (!first) {
        continue;
      }

      if (first.timestamp !== timestamp) {
        throw new Error(
          `Timestamp group "${timestamp}" contains a record from "${first.timestamp}"`,
        );
      }

      for (let secondIndex = firstIndex + 1; secondIndex < people.length; secondIndex += 1) {
        const second = people[secondIndex];
        if (!second) {
          continue;
        }

        if (second.timestamp !== timestamp) {
          throw new Error(
            `Timestamp group "${timestamp}" contains a record from "${second.timestamp}"`,
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
          { lat: second.latitude, lon: second.longitude },
        );

        if (distanciaMetros < MAX_ENCOUNTER_DISTANCE_METERS) {
          detectedPairs.add(key);
          yield { distanciaMetros, participants: [first, second], timestamp };
        }
      }
    }
  }
};
