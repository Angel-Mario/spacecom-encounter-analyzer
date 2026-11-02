export type WorkspaceView = "results" | "map" | "details";

export type ResultFilter = "all" | "generic" | "faction" | "protective";

export interface AnalysisSettings {
  monitor: string;
  timestamp: string;
  distance: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export type EncounterType = "generico" | "faccao" | "protetiva";

export interface Encounter {
  tipo: EncounterType;
  monitoradosEncontro: [number, number];
  timestamp: string;
  posicoes: Record<string, Coordinates>;
  distanciaMetros: number;
}

export interface AnalysisStats {
  datasets: number;
  rowsProcessed: number;
  durationMs: number;
}

export interface AnalysisResult {
  output: string;
  encounters: Encounter[];
  stats: AnalysisStats;
}

export interface DefaultDirectories {
  inputDirectory: string;
  outputDirectory: string;
}
