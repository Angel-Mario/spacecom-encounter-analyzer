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
  noFilteredResults: string;
  previousPage: string;
  nextPage: string;
  latitude: string;
  longitude: string;
  showingEncounters: (count: number) => string;
  pagination: string;
  page: (page: number) => string;
  mapHeading: string;
  mapDescription: string;
  mapLegend: string;
  mapLoading: string;
  mapLoadError: string;
  mapSelection: string;
  mapZoom: string;
  noPoints: string;
  mapWithoutData: string;
  noMapResults: string;
  importToVisualize: string;
  zoomIn: string;
  zoomOut: string;
  resetMap: string;
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
  analysisReady: string;
  analysisRunning: string;
  analysisStarting: string;
  analysisComplete: string;
  analysisFailed: string;
  analysisOutput: string;
  analysisOutputEmpty: string;
  analysisInstructions: string;
  desktopOnly: string;
  demoDataLabel: string;
  demoDataStatus: string;
  demoAnalysisNotice: string;
  demoProcessingDataset: (dataset: string) => string;
  language: string;
  inputDirectory: string;
  outputDirectory: string;
  selectInputFolder: string;
  selectOutputFolder: string;
  windowControls: string;
  minimizeWindow: string;
  maximizeWindow: string;
  restoreWindow: string;
  closeWindow: string;
  windowActionFailed: string;
  revealInExplorer: string;
  revealInExplorerFailed: string;
  exportCompleted: string;
  exportFailed: string;
  statusDatasets: (count: number) => string;
  statusRows: (count: number) => string;
  statusEncounters: (count: number) => string;
  statusElapsed: (value: string) => string;
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
    analysisComplete: "Analysis completed",
    analysisEngine: "Analysis engine",
    analysisFailed: "Analysis failed",
    analysisInstructions: "Choose the input and output folders, then start the analysis.",
    analysisOutput: "CLI output",
    analysisOutputEmpty: "The CLI summary will appear here after the run.",
    analysisPending: "Analysis engine pending",
    analysisReady: "CLI ready",
    analysisRunning: "Processing datasets…",
    analysisStarting: "Starting the CLI process…",
    appSubtitle: "Geolocation encounter analysis",
    bannerDescription: "Explore proximity and time patterns across your datasets.",
    bannerFilesReady: (count) => `${count} dataset${count === 1 ? "" : "s"} ready for analysis`,
    bannerHeading: "Detect encounters with precision",
    bannerImportPrompt: "Choose folders and start your first analysis",
    bannerKicker: "Geospatial analysis",
    chooseResult: "Choose a result to view its data.",
    closeWindow: "Close window",
    configuredEncounterRadius: "Configured encounter radius",
    datasetsImported: (count) => `${count} dataset${count === 1 ? "" : "s"} imported`,
    demoAnalysisNotice: "Demo mode: Start analysis to preview sample CLI output and results.",
    demoDataLabel: "DEMO DATA",
    demoDataStatus: "Sample data — CLI not run",
    demoProcessingDataset: (dataset) => `[DEMO] Processing ${dataset}...`,
    desktopOnly:
      "Folder selection and CLI execution need the Tauri desktop app. Run `pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev` from the repository root.",
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
    inputDirectory: "Input folder",
    invalidFileSelection: "Select files with the .txt extension.",
    language: "Language",
    latitude: "Latitude",
    loadedFiles: "Loaded files",
    localView: "Map view",
    longitude: "Longitude",
    map: "Map",
    mapDescription:
      "Interactive map of encounter locations. Hover for details or select a marker to inspect an encounter.",
    mapHeading: "Encounter map",
    mapLegend: "Encounter types",
    mapLoadError: "The map could not be loaded. Check your internet connection.",
    mapLoading: "Loading map…",
    mapSelection: "Selected encounter",
    mapWithoutData: "Map without data",
    mapZoom: "Map zoom controls",
    maximizeWindow: "Maximize window",
    minimizeWindow: "Minimize window",
    monitorFilter: "Monitor filter",
    monitorIds: "Monitors (ID)",
    monitors: "Monitors",
    needsReview: "Needs review",
    nextPage: "Next page",
    noFilteredResults: "No encounters match these filters.",
    noMapResults: "No results yet",
    noPoints: "No points",
    noResults: "No results yet",
    noResultsDescription: "Import your data and run an analysis to see encounters here.",
    noSelection: "Nothing selected",
    outputDirectory: "Output folder",
    overviewLabel: "Analyzer overview",
    page: (page) => `Page ${page}`,
    pagination: "Pagination",
    previousPage: "Previous page",
    protective: "Protective",
    radius: "Radius",
    removeFile: (name) => `Remove ${name}`,
    resetMap: "Reset map view",
    restoreWindow: "Restore window",
    results: "Results",
    resultsHeading: "Analysis results",
    resultsWillBeAvailable: "Results will be available after analysis runs.",
    searchPlaceholder: "Search ID or timestamp",
    searchResults: "Search results",
    selectEncounter: "Select an encounter",
    selectFiles: "Select files",
    selectFilesAria: "Select dataset files",
    selectInputFolder: "Choose input folder",
    selectOutputFolder: "Choose output folder",
    settingsHeading: "Run analysis",
    settingsLabel: "Analysis folders and execution",
    showingEncounters: (count) => `Showing ${count} encounters`,
    startAnalysis: "Start analysis",
    timestamp: "Timestamp",
    timestampFilter: "Timestamp filter",
    type: "Type",
    valid: "Valid",
    waitingForDatasets: "Waiting for datasets",
    windowActionFailed: "The window action could not be completed.",
    windowControls: "Window controls",
    withCoordinates: "With coordinates",
    withoutCoordinates: "Without coordinates",
    workspaceLabel: "Workspace",
    workspaceViews: "Workspace views",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    revealInExplorer: "Open folder in File Explorer",
    revealInExplorerFailed: "Could not open the folder",
    exportCompleted: "Export completed",
    exportFailed: "Export failed",
    statusDatasets: (count) => `Datasets: ${count}`,
    statusRows: (count) => `Rows processed: ${count}`,
    statusEncounters: (count) => `Encounters: ${count}`,
    statusElapsed: (value) => `Processing time: ${value}`,
  },
  es: {
    acceptedFiles: "Archivos .txt",
    all: "Todos",
    analysisComplete: "Análisis completado",
    analysisEngine: "Motor de análisis",
    analysisFailed: "El análisis falló",
    analysisInstructions: "Elige las carpetas de entrada y salida e inicia el análisis.",
    analysisOutput: "Salida de la CLI",
    analysisOutputEmpty: "El resumen de la CLI aparecerá aquí al finalizar.",
    analysisPending: "Motor de análisis pendiente",
    analysisReady: "CLI lista",
    analysisRunning: "Procesando datasets…",
    analysisStarting: "Iniciando el proceso de la CLI…",
    appSubtitle: "Análisis de encuentros de geolocalización",
    bannerDescription: "Explora proximidad y patrones temporales a partir de tus datasets.",
    bannerFilesReady: (count) =>
      `${count} dataset${count === 1 ? "" : "s"} listo${count === 1 ? "" : "s"} para tu análisis`,
    bannerHeading: "Detecta encuentros con precisión",
    bannerImportPrompt: "Elige las carpetas e inicia tu primer análisis",
    bannerKicker: "Análisis geoespacial",
    chooseResult: "Elige un resultado para consultar sus datos.",
    closeWindow: "Cerrar ventana",
    configuredEncounterRadius: "Radio de encuentro configurado",
    datasetsImported: (count) =>
      `${count} dataset${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"}`,
    demoAnalysisNotice:
      "Modo demo: inicia el análisis para ver una salida de CLI y resultados de ejemplo.",
    demoDataLabel: "DATOS DE DEMOSTRACIÓN",
    demoDataStatus: "Datos de ejemplo — CLI no ejecutada",
    demoProcessingDataset: (dataset) => `[DEMO] Procesando ${dataset}...`,
    desktopOnly:
      "La selección de carpetas y la CLI requieren la app de escritorio Tauri. Ejecuta `pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev` desde la raíz del repositorio.",
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
    inputDirectory: "Carpeta de entrada",
    invalidFileSelection: "Selecciona archivos con extensión .txt.",
    language: "Idioma",
    latitude: "Latitud",
    loadedFiles: "Archivos cargados",
    localView: "Vista del mapa",
    longitude: "Longitud",
    map: "Mapa",
    mapDescription:
      "Mapa interactivo de las ubicaciones de los encuentros. Pasa el cursor para ver detalles o selecciona un marcador para consultar un encuentro.",
    mapHeading: "Mapa de encuentros",
    mapLegend: "Tipos de encuentro",
    mapLoadError: "No se pudo cargar el mapa. Comprueba tu conexión a Internet.",
    mapLoading: "Cargando mapa…",
    mapSelection: "Encuentro seleccionado",
    mapWithoutData: "Mapa sin datos",
    mapZoom: "Controles de zoom del mapa",
    maximizeWindow: "Maximizar ventana",
    minimizeWindow: "Minimizar ventana",
    monitorFilter: "Filtro de monitores",
    monitorIds: "Monitores (ID)",
    monitors: "Monitores",
    needsReview: "Por revisar",
    nextPage: "Página siguiente",
    noFilteredResults: "Ningún encuentro coincide con estos filtros.",
    noMapResults: "Aún no hay resultados",
    noPoints: "Sin puntos",
    noResults: "Todavía no hay resultados",
    noResultsDescription: "Importa tus datos y ejecuta un análisis para ver los encuentros aquí.",
    noSelection: "Sin selección",
    outputDirectory: "Carpeta de salida",
    overviewLabel: "Presentación del analizador",
    page: (page) => `Página ${page}`,
    pagination: "Paginación",
    previousPage: "Página anterior",
    protective: "Protectivos",
    radius: "Radio",
    removeFile: (name) => `Quitar ${name}`,
    resetMap: "Restablecer vista del mapa",
    restoreWindow: "Restaurar ventana",
    results: "Resultados",
    resultsHeading: "Resultados del análisis",
    resultsWillBeAvailable: "Los resultados estarán disponibles al ejecutar el análisis.",
    searchPlaceholder: "Buscar ID o timestamp",
    searchResults: "Buscar en resultados",
    selectEncounter: "Selecciona un encuentro",
    selectFiles: "Seleccionar archivos",
    selectFilesAria: "Seleccionar archivos de datasets",
    selectInputFolder: "Elegir carpeta de entrada",
    selectOutputFolder: "Elegir carpeta de salida",
    settingsHeading: "Ejecutar análisis",
    settingsLabel: "Carpetas y ejecución del análisis",
    showingEncounters: (count) => `Mostrando ${count} encuentros`,
    startAnalysis: "Iniciar análisis",
    timestamp: "Timestamp",
    timestampFilter: "Filtro de timestamp",
    type: "Tipo",
    valid: "Válidos",
    waitingForDatasets: "Esperando datasets",
    windowActionFailed: "No se pudo completar la acción de la ventana.",
    windowControls: "Controles de ventana",
    withCoordinates: "Con coordenadas",
    withoutCoordinates: "Sin coordenadas",
    workspaceLabel: "Espacio de trabajo",
    workspaceViews: "Vistas del espacio de trabajo",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    revealInExplorer: "Abrir la carpeta en el Explorador",
    revealInExplorerFailed: "No se pudo abrir la carpeta",
    exportCompleted: "Exportación completada",
    exportFailed: "La exportación falló",
    statusDatasets: (count) => `Datasets: ${count}`,
    statusRows: (count) => `Filas procesadas: ${count}`,
    statusEncounters: (count) => `Encuentros: ${count}`,
    statusElapsed: (value) => `Tiempo de proceso: ${value}`,
  },
  pt: {
    acceptedFiles: "Arquivos .txt",
    all: "Todos",
    analysisComplete: "Análise concluída",
    analysisEngine: "Mecanismo de análise",
    analysisFailed: "A análise falhou",
    analysisInstructions: "Escolha as pastas de entrada e saída e inicie a análise.",
    analysisOutput: "Saída da CLI",
    analysisOutputEmpty: "O resumo da CLI aparecerá aqui após a execução.",
    analysisPending: "Análise pendente",
    analysisReady: "CLI pronta",
    analysisRunning: "Processando conjuntos de dados…",
    analysisStarting: "Iniciando o processo da CLI…",
    appSubtitle: "Análise de encontros de geolocalização",
    bannerDescription: "Explore proximidade e padrões temporais nos seus conjuntos de dados.",
    bannerFilesReady: (count) =>
      `${count} conjunto${count === 1 ? "" : "s"} de dados pronto${count === 1 ? "" : "s"} para análise`,
    bannerHeading: "Detecte encontros com precisão",
    bannerImportPrompt: "Escolha as pastas e inicie sua primeira análise",
    bannerKicker: "Análise geoespacial",
    chooseResult: "Escolha um resultado para consultar os dados.",
    closeWindow: "Fechar janela",
    configuredEncounterRadius: "Raio do encontro configurado",
    datasetsImported: (count) =>
      `${count} conjunto${count === 1 ? "" : "s"} de dados importado${count === 1 ? "" : "s"}`,
    demoAnalysisNotice:
      "Modo de demonstração: inicie a análise para ver a saída da CLI e resultados de exemplo.",
    demoDataLabel: "DADOS DE DEMONSTRAÇÃO",
    demoDataStatus: "Dados de exemplo — CLI não executada",
    demoProcessingDataset: (dataset) => `[DEMO] Processando ${dataset}...`,
    desktopOnly:
      "A seleção de pastas e a CLI precisam do aplicativo desktop Tauri. Execute `pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev` na raiz do repositório.",
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
    inputDirectory: "Pasta de entrada",
    invalidFileSelection: "Selecione arquivos com a extensão .txt.",
    language: "Idioma",
    latitude: "Latitude",
    loadedFiles: "Arquivos carregados",
    localView: "Visualização do mapa",
    longitude: "Longitude",
    map: "Mapa",
    mapDescription:
      "Mapa interativo dos locais dos encontros. Passe o cursor para ver detalhes ou selecione um marcador para consultar um encontro.",
    mapHeading: "Mapa de encontros",
    mapLegend: "Tipos de encontro",
    mapLoadError: "Não foi possível carregar o mapa. Verifique sua conexão com a internet.",
    mapLoading: "Carregando mapa…",
    mapSelection: "Encontro selecionado",
    mapWithoutData: "Mapa sem dados",
    mapZoom: "Controles de zoom do mapa",
    maximizeWindow: "Maximizar janela",
    minimizeWindow: "Minimizar janela",
    monitorFilter: "Filtro de monitorados",
    monitorIds: "Monitorados (ID)",
    monitors: "Monitorados",
    needsReview: "Revisar",
    nextPage: "Próxima página",
    noFilteredResults: "Nenhum encontro corresponde a esses filtros.",
    noMapResults: "Ainda não há resultados",
    noPoints: "Sem pontos",
    noResults: "Ainda não há resultados",
    noResultsDescription: "Importe seus dados e execute uma análise para ver os encontros aqui.",
    noSelection: "Nenhum selecionado",
    outputDirectory: "Pasta de saída",
    overviewLabel: "Visão geral do analisador",
    page: (page) => `Página ${page}`,
    pagination: "Paginação",
    previousPage: "Página anterior",
    protective: "Protetivos",
    radius: "Raio",
    removeFile: (name) => `Remover ${name}`,
    resetMap: "Redefinir visualização do mapa",
    restoreWindow: "Restaurar janela",
    results: "Resultados",
    resultsHeading: "Resultados da análise",
    resultsWillBeAvailable: "Os resultados estarão disponíveis após a análise.",
    searchPlaceholder: "Pesquisar ID ou data e hora",
    searchResults: "Pesquisar resultados",
    selectEncounter: "Selecione um encontro",
    selectFiles: "Selecionar arquivos",
    selectFilesAria: "Selecionar arquivos de dados",
    selectInputFolder: "Escolher pasta de entrada",
    selectOutputFolder: "Escolher pasta de saída",
    settingsHeading: "Executar análise",
    settingsLabel: "Pastas e execução da análise",
    showingEncounters: (count) => `Exibindo ${count} encontro${count === 1 ? "" : "s"}`,
    startAnalysis: "Iniciar análise",
    timestamp: "Data e hora",
    timestampFilter: "Filtro de data e hora",
    type: "Tipo",
    valid: "Válidos",
    waitingForDatasets: "Aguardando conjuntos de dados",
    windowActionFailed: "Não foi possível concluir a ação da janela.",
    windowControls: "Controles da janela",
    withCoordinates: "Com coordenadas",
    withoutCoordinates: "Sem coordenadas",
    workspaceLabel: "Área de trabalho",
    workspaceViews: "Visualizações da área de trabalho",
    zoomIn: "Aumentar zoom",
    zoomOut: "Diminuir zoom",
    revealInExplorer: "Abrir pasta no Explorador",
    revealInExplorerFailed: "Não foi possível abrir a pasta",
    exportCompleted: "Exportação concluída",
    exportFailed: "A exportação falhou",
    statusDatasets: (count) => `Datasets: ${count}`,
    statusRows: (count) => `Linhas processadas: ${count}`,
    statusEncounters: (count) => `Encontros: ${count}`,
    statusElapsed: (value) => `Tempo de processo: ${value}`,
  },
};

export const getLocaleCopy = (locale: Locale): LocaleCopy => translations[locale];
