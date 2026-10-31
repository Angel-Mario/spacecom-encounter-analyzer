import type { Encounter, EncounterCandidate, EncounterType } from "../../domain.js";

// Verifica se algum dos participantes possui medida protetiva que restringe o outro.
const isProtectiveEncounter = (candidate: EncounterCandidate): boolean => {
  const [first, second] = candidate.participants;

  return (
    (first.hasProtectiveMeasure && first.restrictedIds.includes(second.id)) ||
    (second.hasProtectiveMeasure && second.restrictedIds.includes(first.id))
  );
};

// Classifica o tipo do encontro na ordem de precedência exigida pelo desafio:
// protetiva > faccao > generico.
const classifyEncounterType = (candidate: EncounterCandidate): EncounterType => {
  if (isProtectiveEncounter(candidate)) {
    return "protetiva";
  }

  const [first, second] = candidate.participants;
  if (first.factionId !== null && first.factionId === second.factionId) {
    return "faccao";
  }

  return "generico";
};

// Constrói o objeto de encontro com os campos na ordem exigida pelo desafio:
// tipo, monitoradosEncontro, timestamp, posicoes, distanciaMetros.
export const classifyEncounter = (candidate: EncounterCandidate): Encounter => {
  const [first, second] = candidate.participants;

  // eslint-disable-next-line sort-keys
  // biome-ignore format: Preserve property order
  // oxlint-disable sort-keys
  return {
    tipo: classifyEncounterType(candidate),
    monitoradosEncontro: [first.id, second.id],
    timestamp: candidate.timestamp,
    posicoes: {
      [first.id]: { lat: first.latitude, lon: first.longitude },
      [second.id]: { lat: second.latitude, lon: second.longitude },
    },
    distanciaMetros: candidate.distanciaMetros,
  };
  // oxlint-enable sort-keys
};
