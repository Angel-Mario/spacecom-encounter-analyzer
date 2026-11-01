export type Locale = "en" | "es" | "pt";
export type UploadMessage = "" | "ignored" | "invalid" | "updated";

export interface LocaleCopy {
  appSubtitle: string;
  overviewLabel: string;
  workspaceLabel: string;
  bannerKicker: string;
  bannerHeading: string;
  bannerDescription: string;
  bannerFilesReady: (count: number) => string;
  bannerImportPrompt: string;
  importHeading: string;
  dropAreaLabel: string;
  dropTitle: string;
  dropSubtitle: string;
  acceptedFiles: string;
  selectFiles: string;
  selectFilesAria: string;
  emptyFiles: string;
  loadedFiles: string;
  removeFile: (name: string) => string;
  invalidFileSelection: string;
  ignoredFiles: string;
  filesUpdated: string;
  settingsLabel: string;
  settingsHeading: string;
  monitors: string;
  timestamp: string;
  distance: string;
  radius: string;
  all: string;
  withCoordinates: string;
  withoutCoordinates: string;
  valid: string;
  needsReview: string;
  startAnalysis: string;
  importToEnableAnalysis: string;
  engineNotConnected: string;
  importToPrepareAnalysis: string;
  engineComingSoon: string;
  workspaceViews: string;
  results: string;
  map: string;
  details: string;
  export: string;
  exportUnavailable: string;
  datasetsImported: (count: number) => string;
  waitingForDatasets: string;
  localView: string;
  resultsHeading: string;
  resultsWillBeAvailable: string;
  importDatasetsToPrepare: string;
  searchResults: string;
  searchPlaceholder: string;
  filterResults: string;
  generic: string;
  faction: string;
  protective: string;
  encountersTable: string;
  type: string;
  monitorIds: string;
  distanceMeters: string;
  noResults: string;
  noResultsDescription: string;
  showingEncounters: (count: number) => string;
  pagination: string;
  page: (page: number) => string;
  mapHeading: string;
  mapDescription: string;
  noPoints: string;
  mapWithoutData: string;
  noMapResults: string;
  importToVisualize: string;
  encounterDetails: string;
  chooseResult: string;
  noSelection: string;
  selectEncounter: string;
  encounterDataWillAppear: string;
  filesImported: (count: number) => string;
  configuredEncounterRadius: string;
  monitorFilter: string;
  timestampFilter: string;
  analysisEngine: string;
  analysisPending: string;
  language: string;
}

export const localeOptions: { label: string; value: Locale }[] = [
  { label: "Español", value: "es" },
  { label: "English", value: "en" },
  { label: "Português", value: "pt" },
];

export const getInitialLocale = (): Locale => {
  const savedLocale = window.localStorage.getItem("spacecom-locale");

  if (savedLocale === "en" || savedLocale === "es" || savedLocale === "pt") {
    return savedLocale;
  }

  const systemLocale = navigator.language.toLowerCase();

  if (systemLocale.startsWith("pt")) {
    return "pt";
  }

  if (systemLocale.startsWith("en")) {
    return "en";
  }

  return "es";
};

const translations: Record<Locale, LocaleCopy> = {
  en: {
    acceptedFiles: ".txt files",
    all: "All",
    analysisEngine: "Analysis engine",
    analysisPending: "Analysis engine pending",
    appSubtitle: "Geolocation encounter analysis",
    bannerDescription: "Explore proximity and time patterns across your datasets.",
    bannerFilesReady: (count) => `${count} dataset${count === 1 ? "" : "s"} ready for analysis`,
    bannerHeading: "Detect encounters with precision",
    bannerImportPrompt: "Import your files to get started",
    bannerKicker: "Geospatial analysis",
    chooseResult: "Choose a result to view its data.",
    configuredEncounterRadius: "Configured encounter radius",
    datasetsImported: (count) => `${count} dataset${count === 1 ? "" : "s"} imported`,
    details: "Details",
    distance: "Distance (m)",
    distanceMeters: "Distance (m)",
    dropAreaLabel: "Drop area for .txt files",
    dropSubtitle: "or select files",
    dropTitle: "Drag your files here",
    emptyFiles: "Your files will appear here.",
    encounterDataWillAppear: "Participants, location, and timestamp will appear here.",
    encounterDetails: "Encounter details",
    encountersTable: "Encounter results",
    engineComingSoon: "The analysis engine will be available soon.",
    engineNotConnected: "The analysis engine is not connected yet.",
    export: "Export",
    exportUnavailable: "Run an analysis to export the results.",
    faction: "Faction",
    filesImported: (count) => `${count} ${count === 1 ? "file" : "files"}`,
    filesUpdated: ".txt file list updated.",
    filterResults: "Filter results by type",
    generic: "Generic",
    ignoredFiles: "Only .txt files are supported; other files were skipped.",
    importDatasetsToPrepare: "Import your datasets to prepare an analysis.",
    importHeading: "Import datasets",
    importToEnableAnalysis: "Import datasets to enable analysis.",
    importToPrepareAnalysis: "Import .txt datasets to prepare the analysis.",
    importToVisualize: "Import your datasets and run an analysis to visualize locations.",
    invalidFileSelection: "Select files with the .txt extension.",
    language: "Language",
    loadedFiles: "Loaded files",
    localView: "Local view",
    map: "Map",
    mapDescription: "The geographic view will be available after processing.",
    mapHeading: "Encounter map",
    mapWithoutData: "Map without data",
    monitorFilter: "Monitor filter",
    monitorIds: "Monitors (ID)",
    monitors: "Monitors",
    needsReview: "Needs review",
    noMapResults: "No results yet",
    noPoints: "No points",
    noResults: "No results yet",
    noResultsDescription: "Import your data and run an analysis to see encounters here.",
    noSelection: "Nothing selected",
    overviewLabel: "Analyzer overview",
    page: (page) => `Page ${page}`,
    pagination: "Pagination",
    protective: "Protective",
    radius: "Radius",
    removeFile: (name) => `Remove ${name}`,
    results: "Results",
    resultsHeading: "Analysis results",
    resultsWillBeAvailable: "Results will be available after analysis runs.",
    searchPlaceholder: "Search ID or timestamp",
    searchResults: "Search results",
    selectEncounter: "Select an encounter",
    selectFiles: "Select files",
    selectFilesAria: "Select dataset files",
    settingsHeading: "Configure and analyze",
    settingsLabel: "Analysis settings",
    showingEncounters: (count) => `Showing ${count} encounters`,
    startAnalysis: "Start analysis",
    timestamp: "Timestamp",
    timestampFilter: "Timestamp filter",
    type: "Type",
    valid: "Valid",
    waitingForDatasets: "Waiting for datasets",
    withCoordinates: "With coordinates",
    withoutCoordinates: "Without coordinates",
    workspaceLabel: "Workspace",
    workspaceViews: "Workspace views",
  },
  es: {
    acceptedFiles: "Archivos .txt",
    all: "Todos",
    analysisEngine: "Motor de análisis",
    analysisPending: "Motor de análisis pendiente",
    appSubtitle: "Análisis de encuentros de geolocalización",
    bannerDescription: "Explora proximidad y patrones temporales a partir de tus datasets.",
    bannerFilesReady: (count) =>
      `${count} dataset${count === 1 ? "" : "s"} listo${count === 1 ? "" : "s"} para tu análisis`,
    bannerHeading: "Detecta encuentros con precisión",
    bannerImportPrompt: "Importa tus archivos para comenzar",
    bannerKicker: "Análisis geoespacial",
    chooseResult: "Elige un resultado para consultar sus datos.",
    configuredEncounterRadius: "Radio de encuentro configurado",
    datasetsImported: (count) =>
      `${count} dataset${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"}`,
    details: "Detalles",
    distance: "Distancia (m)",
    distanceMeters: "Distancia (m)",
    dropAreaLabel: "Área para importar archivos .txt",
    dropSubtitle: "o selecciona archivos",
    dropTitle: "Arrastra tus archivos aquí",
    emptyFiles: "Tus archivos aparecerán aquí.",
    encounterDataWillAppear: "Sus participantes, ubicación y marca temporal aparecerán aquí.",
    encounterDetails: "Detalles del encuentro",
    encountersTable: "Resultados de encuentros",
    engineComingSoon: "El motor de análisis estará disponible próximamente.",
    engineNotConnected: "El motor de análisis aún no está conectado.",
    export: "Exportar",
    exportUnavailable: "Ejecuta un análisis para exportar los resultados.",
    faction: "Facción",
    filesImported: (count) => `${count} ${count === 1 ? "archivo" : "archivos"}`,
    filesUpdated: "Lista de archivos .txt actualizada.",
    filterResults: "Filtrar resultados por tipo",
    generic: "Genéricos",
    ignoredFiles: "Solo se admiten archivos .txt; los demás se omitieron.",
    importDatasetsToPrepare: "Importa tus datasets para preparar un análisis.",
    importHeading: "Importar datasets",
    importToEnableAnalysis: "Importa datasets para habilitar el análisis.",
    importToPrepareAnalysis: "Importa datasets .txt para preparar el análisis.",
    importToVisualize:
      "Importa tus datasets y ejecuta un análisis para visualizar las ubicaciones.",
    invalidFileSelection: "Selecciona archivos con extensión .txt.",
    language: "Idioma",
    loadedFiles: "Archivos cargados",
    localView: "Vista local",
    map: "Mapa",
    mapDescription: "La vista geográfica se completará cuando proceses tus datos.",
    mapHeading: "Mapa de encuentros",
    mapWithoutData: "Mapa sin datos",
    monitorFilter: "Filtro de monitores",
    monitorIds: "Monitores (ID)",
    monitors: "Monitores",
    needsReview: "Por revisar",
    noMapResults: "Aún no hay resultados",
    noPoints: "Sin puntos",
    noResults: "Todavía no hay resultados",
    noResultsDescription: "Importa tus datos y ejecuta un análisis para ver los encuentros aquí.",
    noSelection: "Sin selección",
    overviewLabel: "Presentación del analizador",
    page: (page) => `Página ${page}`,
    pagination: "Paginación",
    protective: "Protectivos",
    radius: "Radio",
    removeFile: (name) => `Quitar ${name}`,
    results: "Resultados",
    resultsHeading: "Resultados del análisis",
    resultsWillBeAvailable: "Los resultados estarán disponibles al ejecutar el análisis.",
    searchPlaceholder: "Buscar ID o timestamp",
    searchResults: "Buscar en resultados",
    selectEncounter: "Selecciona un encuentro",
    selectFiles: "Seleccionar archivos",
    selectFilesAria: "Seleccionar archivos de datasets",
    settingsHeading: "Configurar y analizar",
    settingsLabel: "Configuración del análisis",
    showingEncounters: (count) => `Mostrando ${count} encuentros`,
    startAnalysis: "Iniciar análisis",
    timestamp: "Timestamp",
    timestampFilter: "Filtro de timestamp",
    type: "Tipo",
    valid: "Válidos",
    waitingForDatasets: "Esperando datasets",
    withCoordinates: "Con coordenadas",
    withoutCoordinates: "Sin coordenadas",
    workspaceLabel: "Espacio de trabajo",
    workspaceViews: "Vistas del espacio de trabajo",
  },
  pt: {
    acceptedFiles: "Arquivos .txt",
    all: "Todos",
    analysisEngine: "Mecanismo de análise",
    analysisPending: "Análise pendente",
    appSubtitle: "Análise de encontros de geolocalização",
    bannerDescription: "Explore proximidade e padrões temporais nos seus conjuntos de dados.",
    bannerFilesReady: (count) =>
      `${count} conjunto${count === 1 ? "" : "s"} de dados pronto${count === 1 ? "" : "s"} para análise`,
    bannerHeading: "Detecte encontros com precisão",
    bannerImportPrompt: "Importe seus arquivos para começar",
    bannerKicker: "Análise geoespacial",
    chooseResult: "Escolha um resultado para consultar os dados.",
    configuredEncounterRadius: "Raio do encontro configurado",
    datasetsImported: (count) =>
      `${count} conjunto${count === 1 ? "" : "s"} de dados importado${count === 1 ? "" : "s"}`,
    details: "Detalhes",
    distance: "Distância (m)",
    distanceMeters: "Distância (m)",
    dropAreaLabel: "Área para importar arquivos .txt",
    dropSubtitle: "ou selecione arquivos",
    dropTitle: "Arraste seus arquivos para cá",
    emptyFiles: "Seus arquivos aparecerão aqui.",
    encounterDataWillAppear: "Participantes, localização e data e hora aparecerão aqui.",
    encounterDetails: "Detalhes do encontro",
    encountersTable: "Resultados dos encontros",
    engineComingSoon: "O mecanismo de análise estará disponível em breve.",
    engineNotConnected: "O mecanismo de análise ainda não está conectado.",
    export: "Exportar",
    exportUnavailable: "Execute uma análise para exportar os resultados.",
    faction: "Facção",
    filesImported: (count) => `${count} ${count === 1 ? "arquivo" : "arquivos"}`,
    filesUpdated: "Lista de arquivos .txt atualizada.",
    filterResults: "Filtrar resultados por tipo",
    generic: "Genéricos",
    ignoredFiles: "Somente arquivos .txt são aceitos; os demais foram ignorados.",
    importDatasetsToPrepare: "Importe seus conjuntos de dados para preparar uma análise.",
    importHeading: "Importar conjuntos de dados",
    importToEnableAnalysis: "Importe conjuntos de dados para habilitar a análise.",
    importToPrepareAnalysis: "Importe conjuntos de dados .txt para preparar a análise.",
    importToVisualize:
      "Importe seus conjuntos de dados e execute uma análise para visualizar as localizações.",
    invalidFileSelection: "Selecione arquivos com a extensão .txt.",
    language: "Idioma",
    loadedFiles: "Arquivos carregados",
    localView: "Visualização local",
    map: "Mapa",
    mapDescription: "A visualização geográfica ficará disponível após o processamento.",
    mapHeading: "Mapa de encontros",
    mapWithoutData: "Mapa sem dados",
    monitorFilter: "Filtro de monitorados",
    monitorIds: "Monitorados (ID)",
    monitors: "Monitorados",
    needsReview: "Revisar",
    noMapResults: "Ainda não há resultados",
    noPoints: "Sem pontos",
    noResults: "Ainda não há resultados",
    noResultsDescription: "Importe seus dados e execute uma análise para ver os encontros aqui.",
    noSelection: "Nenhum selecionado",
    overviewLabel: "Visão geral do analisador",
    page: (page) => `Página ${page}`,
    pagination: "Paginação",
    protective: "Protetivos",
    radius: "Raio",
    removeFile: (name) => `Remover ${name}`,
    results: "Resultados",
    resultsHeading: "Resultados da análise",
    resultsWillBeAvailable: "Os resultados estarão disponíveis após a análise.",
    searchPlaceholder: "Pesquisar ID ou data e hora",
    searchResults: "Pesquisar resultados",
    selectEncounter: "Selecione um encontro",
    selectFiles: "Selecionar arquivos",
    selectFilesAria: "Selecionar arquivos de dados",
    settingsHeading: "Configurar e analisar",
    settingsLabel: "Configurações da análise",
    showingEncounters: (count) => `Exibindo ${count} encontro${count === 1 ? "" : "s"}`,
    startAnalysis: "Iniciar análise",
    timestamp: "Data e hora",
    timestampFilter: "Filtro de data e hora",
    type: "Tipo",
    valid: "Válidos",
    waitingForDatasets: "Aguardando conjuntos de dados",
    withCoordinates: "Com coordenadas",
    withoutCoordinates: "Sem coordenadas",
    workspaceLabel: "Área de trabalho",
    workspaceViews: "Visualizações da área de trabalho",
  },
};

export const getLocaleCopy = (locale: Locale): LocaleCopy => translations[locale];
