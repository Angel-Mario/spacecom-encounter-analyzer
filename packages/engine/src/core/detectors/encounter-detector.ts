import type { EncounterCandidate, MonitoredPerson, Timestamp } from "../../domain.js";
import { calculateDistanceMeters, EARTH_RADIUS_METERS } from "../algorithms/haversine.js";

// Distância limite (em metros) para configurar um encontro, conforme regra do desafio.
export const MAX_ENCOUNTER_DISTANCE_METERS = 20;

// Tamanho de cada célula do índice espacial. Um par a 20 m tem diferenças cartesianas
// menores que 25 m, portanto células vizinhas sempre cobrem todos os candidatos reais.
const SPATIAL_CELL_SIZE_METERS = 25;

// Parâmetros do hash das células espaciais (módulo primo e multiplicador).
const CELL_HASH_MODULUS = 4_294_967_291;
const CELL_HASH_MULTIPLIER = 1_000_003;

// Para grupos pequenos a varredura naïve de todos os pares é mais rápida do que
// montar o índice espacial e percorrer as 27 células vizinhas.
const NAIVE_PAIR_THRESHOLD = 40;

// A distância de grande-círculo d e a corda 3-D c entre dois pontos na esfera
// satisfazem d = 2·R·asin(c / (2·R)). O ruído de ponto flutuante é limitado a ~1e-8 m,
// portanto pares além da faixa de verificação ignoram a fórmula de Haversine, e pares
// dentro da faixa ainda recebem a decisão exata que a comparação de Haversine daria.
const CHORD_LIMIT_METERS =
  2 * EARTH_RADIUS_METERS * Math.sin(MAX_ENCOUNTER_DISTANCE_METERS / (2 * EARTH_RADIUS_METERS));
const CHORD_VERIFY_SQUARED_METERS = (CHORD_LIMIT_METERS + 1e-3) ** 2;

type TimestampGroup = readonly [Timestamp, readonly MonitoredPerson[]];
type TimestampGroups = AsyncIterable<TimestampGroup> | Iterable<TimestampGroup>;

// Gera uma chave canônica para o par (sem importar a ordem dos IDs), garantindo unicidade.
const pairKey = (firstId: number, secondId: number): string =>
  firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;

// Entrada do índice espacial: coordenadas cartesianas ECEF e célula do hash.
interface SpatialEntry {
  cellX: number;
  cellY: number;
  cellZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  index: number;
}

// Converte as coordenadas geográficas de um monitorado para o sistema ECEF (Earth-Centered,
// Earth-Fixed) e calcula a célula do índice espacial correspondente.
const getSpatialEntry = (person: MonitoredPerson, index: number): SpatialEntry => {
  const latitude = (person.latitude * Math.PI) / 180;
  const longitude = (person.longitude * Math.PI) / 180;
  const latitudeRadius = EARTH_RADIUS_METERS * Math.cos(latitude);
  const positionX = latitudeRadius * Math.cos(longitude);
  const positionY = latitudeRadius * Math.sin(longitude);
  const positionZ = EARTH_RADIUS_METERS * Math.sin(latitude);

  // Um par a menos de 20 m tem diferenças de coordenadas cartesianas abaixo do tamanho de célula de 25 m.
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

// Gera um hash inteiro para uma célula do índice espacial a partir de suas coordenadas discretas.
const hashCell = (cellX: number, cellY: number, cellZ: number): number => {
  let hash = ((cellX % CELL_HASH_MODULUS) + CELL_HASH_MODULUS) % CELL_HASH_MODULUS;
  hash = (hash * CELL_HASH_MULTIPLIER + cellY) % CELL_HASH_MODULUS;
  return (hash * CELL_HASH_MULTIPLIER + cellZ) % CELL_HASH_MODULUS;
};

// Percorre as 27 células vizinhas (3×3×3) ao redor da célula da primeira entrada e
// coleta os índices de todos os candidatos que compartilham células adjacentes.
// Colisões de hash apenas aumentam o trabalho; a verificação exata da célula descarta
// candidatos que não são vizinhos reais.
const findCandidateIndexes = (
  firstEntry: SpatialEntry,
  spatialIndex: Map<number, SpatialEntry[]>,
  candidateIndexes: number[],
): void => {
  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        const bucket = spatialIndex.get(
          hashCell(
            firstEntry.cellX + offsetX,
            firstEntry.cellY + offsetY,
            firstEntry.cellZ + offsetZ,
          ),
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
            // Duplicatas de colisões de hash são seguras: o conjunto de chaves de par
            // descarta encontros repetidos.
            candidateIndexes.push(candidate.index);
          }
        }
      }
    }
  }
};

// Verifica se o par (first, second) forma um encontro válido (distância < 20 m),
// usando o gate de corda ECEF como filtro rápido antes da Haversine.
// Retorna a distância em metros ou undefined se o par não forma encontro.
const considerEncounter = (
  first: MonitoredPerson,
  firstEntry: SpatialEntry,
  second: MonitoredPerson,
  secondEntry: SpatialEntry,
  detectedPairs: Set<string>,
): number | undefined => {
  if (first.id === second.id) {
    return undefined;
  }

  const key = pairKey(first.id, second.id);
  if (detectedPairs.has(key)) {
    return undefined;
  }

  // Gate de corda 3-D: descarta pares cuja corda excede o limite derivado de 20 m.
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

  // Apenas pares que passaram pelo gate chegam ao cálculo exato de Haversine.
  const distanciaMetros = calculateDistanceMeters(
    { lat: first.latitude, lon: first.longitude },
    { lat: second.latitude, lon: second.longitude },
  );

  if (distanciaMetros >= MAX_ENCOUNTER_DISTANCE_METERS) {
    return undefined;
  }

  detectedPairs.add(key);
  return distanciaMetros;
};

// Valida que todos os registros do grupo pertencem ao timestamp declarado.
const validateGroupTimestamps = (
  timestamp: Timestamp,
  people: readonly MonitoredPerson[],
): void => {
  for (const person of people) {
    if (person.timestamp !== timestamp) {
      throw new Error(
        `Timestamp group "${timestamp}" contains a record from "${person.timestamp}"`,
      );
    }
  }
};

// Detecta todos os encontros em um único grupo de timestamp.
// Para grupos pequenos usa varredura naïve; para grupos grandes usa o índice espacial de hash.
export const detectEncountersInGroup = function* detectEncountersInGroup(
  timestamp: Timestamp,
  people: readonly MonitoredPerson[],
): Generator<EncounterCandidate> {
  validateGroupTimestamps(timestamp, people);
  if (people.length < 2) {
    return;
  }

  const detectedPairs = new Set<string>();
  const spatialEntries = people.map(getSpatialEntry);

  // Varredura naïve de pares: mais eficiente que o índice espacial para grupos pequenos.
  if (people.length < NAIVE_PAIR_THRESHOLD) {
    for (let firstIndex = 0; firstIndex < people.length; firstIndex += 1) {
      const first = people[firstIndex];
      const firstEntry = spatialEntries[firstIndex];
      if (!first || !firstEntry) {
        continue;
      }

      for (let secondIndex = firstIndex + 1; secondIndex < people.length; secondIndex += 1) {
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
          detectedPairs,
        );
        if (distanciaMetros !== undefined) {
          yield { distanciaMetros, participants: [first, second], timestamp };
        }
      }
    }

    return;
  }

  // Índice espacial de hash: agrupa entradas por célula para restringir as comparações
  // de distância apenas aos vizinhos próximos.
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

  for (let firstIndex = 0; firstIndex < spatialEntries.length; firstIndex += 1) {
    const firstEntry = spatialEntries[firstIndex];
    const first = people[firstIndex];
    if (!firstEntry || !first) {
      continue;
    }

    candidateIndexes.length = 0;

    findCandidateIndexes(firstEntry, spatialIndex, candidateIndexes);

    // Candidatos únicos não precisam de ordenação; listas maiores são ordenadas para
    // manter a mesma ordem de encontros do caminho naïve (pares em ordem crescente de índice).
    if (candidateIndexes.length > 1) {
      candidateIndexes.sort(
        (firstCandidateIndex, secondCandidateIndex) => firstCandidateIndex - secondCandidateIndex,
      );
    }

    // Duplicatas de colisões de hash são inofensivas: considerEncounter descarta pares repetidos.
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
        detectedPairs,
      );
      if (distanciaMetros !== undefined) {
        yield { distanciaMetros, participants: [first, second], timestamp };
      }
    }
  }
};

// Detecta encontros em todos os grupos de timestamps fornecidos como iterável ou async iterável.
export const detectEncounters = async function* detectEncounters(
  groups: TimestampGroups,
): AsyncGenerator<EncounterCandidate> {
  for await (const [timestamp, people] of groups) {
    yield* detectEncountersInGroup(timestamp, people);
  }
};
