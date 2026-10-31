export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Encounter {
  tipo: EncounterType;
  monitoradosEncontro: [number, number];
  timestamp: Timestamp;
  posicoes: Record<string, Coordinates>;
  distanciaMetros: number;
}

export interface EncounterCandidate {
  timestamp: Timestamp;
  participants: readonly [MonitoredPerson, MonitoredPerson];
  distanciaMetros: number;
}

export type EncounterType = "generico" | "faccao" | "protetiva";

export interface MonitoredPerson {
  id: number;
  factionId: number | null;
  timestamp: Timestamp;
  latitude: number;
  longitude: number;
  hasProtectiveMeasure: boolean;
  restrictedIds: number[];
}

export type Timestamp = string;
