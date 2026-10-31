import type { Encounter, EncounterCandidate, EncounterType } from "../../domain.js";

const isProtectiveEncounter = (candidate: EncounterCandidate): boolean => {
  const [first, second] = candidate.participants;

  return (
    (first.hasProtectiveMeasure && first.restrictedIds.includes(second.id)) ||
    (second.hasProtectiveMeasure && second.restrictedIds.includes(first.id))
  );
};

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

export const classifyEncounter = (candidate: EncounterCandidate): Encounter => {
  const [first, second] = candidate.participants;

  return {
    distanciaMetros: candidate.distanciaMetros,
    monitoradosEncontro: [first.id, second.id],
    posicoes: {
      [first.id]: { lat: first.latitude, lon: first.longitude },
      [second.id]: { lat: second.latitude, lon: second.longitude },
    },
    timestamp: candidate.timestamp,
    tipo: classifyEncounterType(candidate),
  };
};
