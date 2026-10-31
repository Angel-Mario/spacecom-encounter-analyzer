// Coordenadas geográficas de um ponto (latitude e longitude em graus decimais).
export interface Coordinates {
  lat: number;
  lon: number;
}

// Representação de um encontro detectado, conforme o formato de saída exigido pelo desafio.
// Os campos estão na ordem exigida: tipo, monitoradosEncontro, timestamp, posicoes, distanciaMetros.
export interface Encounter {
  tipo: EncounterType;
  monitoradosEncontro: [number, number];
  timestamp: Timestamp;
  posicoes: Record<string, Coordinates>;
  distanciaMetros: number;
}

// Par de monitorados que passaram o gate de distância e aguardam classificação de tipo.
export interface EncounterCandidate {
  timestamp: Timestamp;
  participants: readonly [MonitoredPerson, MonitoredPerson];
  distanciaMetros: number;
}

// Tipo do encontro: genérico, de facção ou de medida protetiva.
export type EncounterType = "generico" | "faccao" | "protetiva";

// Registro de um indivíduo monitorado (tornozeleira ou vítima com rastreador).
export interface MonitoredPerson {
  id: number;
  // Identificador da facção; null quando o campo está vazio no dataset.
  factionId: number | null;
  timestamp: Timestamp;
  latitude: number;
  longitude: number;
  // Indica se esta pessoa possui medida protetiva ativa.
  hasProtectiveMeasure: boolean;
  // IDs dos agressores cujo acesso esta pessoa tem restrição (idsRestricaoMedida).
  restrictedIds: number[];
}

// Timestamp no formato "YYYY-MM-DD HH:MM:SS", conforme especificado pelo desafio.
export type Timestamp = string;
