import { describe, expect, it } from "vitest";

import type { EncounterCandidate, MonitoredPerson } from "../../domain.js";
import { classifyEncounter } from "./encounter-classifier.js";

const createPerson = (id: number, options: Partial<MonitoredPerson> = {}): MonitoredPerson => ({
  factionId: null,
  hasProtectiveMeasure: false,
  id,
  latitude: -23.55 + id / 100_000,
  longitude: -46.63,
  restrictedIds: [],
  timestamp: "2026-10-30 18:00:00",
  ...options,
});

const createCandidate = (first: MonitoredPerson, second: MonitoredPerson): EncounterCandidate => ({
  distanciaMetros: 12.5,
  participants: [first, second],
  timestamp: first.timestamp,
});

describe("classifyEncounter", () => {
  it("classifies unrelated monitored people as a generic encounter", () => {
    const first = createPerson(1);
    const second = createPerson(2);

    expect(classifyEncounter(createCandidate(first, second))).toEqual({
      distanciaMetros: 12.5,
      monitoradosEncontro: [1, 2],
      posicoes: {
        "1": { lat: first.latitude, lon: first.longitude },
        "2": { lat: second.latitude, lon: second.longitude },
      },
      timestamp: first.timestamp,
      tipo: "generico",
    });
  });

  it("classifies people from the same non-null faction as a faction encounter", () => {
    const first = createPerson(1, { factionId: 7 });
    const second = createPerson(2, { factionId: 7 });

    expect(classifyEncounter(createCandidate(first, second)).tipo).toBe("faccao");
  });

  it("does not treat two people without a faction as faction members", () => {
    const first = createPerson(1);
    const second = createPerson(2);

    expect(classifyEncounter(createCandidate(first, second)).tipo).toBe("generico");
  });

  it("classifies a restricted aggressor-victim pair as protective in either order", () => {
    const victim = createPerson(10, {
      hasProtectiveMeasure: true,
      restrictedIds: [9],
    });
    const aggressor = createPerson(9);

    expect(classifyEncounter(createCandidate(victim, aggressor)).tipo).toBe("protetiva");
    expect(classifyEncounter(createCandidate(aggressor, victim)).tipo).toBe("protetiva");
  });

  it("does not classify a protective-measure holder as a protective encounter without a matching restriction", () => {
    const victim = createPerson(10, {
      hasProtectiveMeasure: true,
      restrictedIds: [11],
    });
    const otherPerson = createPerson(9);

    expect(classifyEncounter(createCandidate(victim, otherPerson)).tipo).toBe("generico");
  });

  it("prioritizes a matching protective restriction over a shared faction", () => {
    const victim = createPerson(10, {
      factionId: 4,
      hasProtectiveMeasure: true,
      restrictedIds: [9],
    });
    const aggressor = createPerson(9, { factionId: 4 });

    expect(classifyEncounter(createCandidate(victim, aggressor)).tipo).toBe("protetiva");
  });
});
