export type WorkspaceView = "results" | "map" | "details";

export type ResultFilter = "all" | "generic" | "faction" | "protective";

export interface AnalysisSettings {
  monitor: string;
  timestamp: string;
  distance: string;
}
