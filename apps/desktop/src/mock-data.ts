import type { Encounter } from "./types";

export const demoEncounters: Encounter[] = [
  {
    distanciaMetros: 7.24,
    monitoradosEncontro: [1042, 1187],
    posicoes: {
      "1042": { lat: -23.55052, lon: -46.63331 },
      "1187": { lat: -23.55058, lon: -46.63328 },
    },
    timestamp: "2026-10-28 08:15:00",
    tipo: "generico",
  },
  {
    distanciaMetros: 9.18,
    monitoradosEncontro: [2061, 2094],
    posicoes: {
      "2061": { lat: -23.56141, lon: -46.65592 },
      "2094": { lat: -23.56149, lon: -46.65588 },
    },
    timestamp: "2026-10-28 09:42:15",
    tipo: "faccao",
  },
  {
    distanciaMetros: 10.37,
    monitoradosEncontro: [3108, 4112],
    posicoes: {
      "3108": { lat: -23.58324, lon: -46.64531 },
      "4112": { lat: -23.5832, lon: -46.64539 },
    },
    timestamp: "2026-10-28 10:06:30",
    tipo: "protetiva",
  },
  {
    distanciaMetros: 8.44,
    monitoradosEncontro: [1220, 1305],
    posicoes: {
      "1220": { lat: -23.54891, lon: -46.63812 },
      "1305": { lat: -23.54895, lon: -46.63819 },
    },
    timestamp: "2026-10-28 11:20:00",
    tipo: "generico",
  },
  {
    distanciaMetros: 8.96,
    monitoradosEncontro: [2217, 2240],
    posicoes: {
      "2217": { lat: -23.57013, lon: -46.6472 },
      "2240": { lat: -23.57009, lon: -46.64727 },
    },
    timestamp: "2026-10-28 12:05:45",
    tipo: "faccao",
  },
  {
    distanciaMetros: 7.56,
    monitoradosEncontro: [1456, 1522],
    posicoes: {
      "1456": { lat: -23.55592, lon: -46.62517 },
      "1522": { lat: -23.55598, lon: -46.62513 },
    },
    timestamp: "2026-10-28 13:18:20",
    tipo: "generico",
  },
  {
    distanciaMetros: 6.08,
    monitoradosEncontro: [3301, 4320],
    posicoes: {
      "3301": { lat: -23.5946, lon: -46.68921 },
      "4320": { lat: -23.59465, lon: -46.68918 },
    },
    timestamp: "2026-10-28 14:32:10",
    tipo: "protetiva",
  },
  {
    distanciaMetros: 7.14,
    monitoradosEncontro: [2341, 2388],
    posicoes: {
      "2341": { lat: -23.53228, lon: -46.63942 },
      "2388": { lat: -23.53234, lon: -46.63939 },
    },
    timestamp: "2026-10-28 15:47:00",
    tipo: "faccao",
  },
  {
    distanciaMetros: 8.61,
    monitoradosEncontro: [1680, 1755],
    posicoes: {
      "1680": { lat: -23.56378, lon: -46.63105 },
      "1755": { lat: -23.56382, lon: -46.63112 },
    },
    timestamp: "2026-10-28 16:03:35",
    tipo: "generico",
  },
  {
    distanciaMetros: 7.22,
    monitoradosEncontro: [3524, 4509],
    posicoes: {
      "3524": { lat: -23.57441, lon: -46.66083 },
      "4509": { lat: -23.57445, lon: -46.66078 },
    },
    timestamp: "2026-10-28 17:26:50",
    tipo: "protetiva",
  },
  {
    distanciaMetros: 8.4,
    monitoradosEncontro: [1811, 1964],
    posicoes: {
      "1811": { lat: -23.54132, lon: -46.62076 },
      "1964": { lat: -23.54137, lon: -46.62082 },
    },
    timestamp: "2026-10-28 18:14:05",
    tipo: "generico",
  },
  {
    distanciaMetros: 8.05,
    monitoradosEncontro: [2482, 2516],
    posicoes: {
      "2482": { lat: -23.58617, lon: -46.63247 },
      "2516": { lat: -23.58621, lon: -46.63241 },
    },
    timestamp: "2026-10-28 19:51:40",
    tipo: "faccao",
  },
];

interface DemoDatasetSummary {
  dataset: string;
  records: number;
  timestamps: number;
  elapsedSeconds: number;
  heapUsedMegabytes: number;
  rssMegabytes: number;
  outputPath: string;
}

const demoDatasetSummaries: DemoDatasetSummary[] = [
  {
    dataset: "dataset1.txt",
    elapsedSeconds: 0.84,
    heapUsedMegabytes: 42.6,
    outputPath: "datasets/outputs/respostas1.json",
    records: 1240,
    rssMegabytes: 96.2,
    timestamps: 978,
  },
  {
    dataset: "dataset2.txt",
    elapsedSeconds: 0.67,
    heapUsedMegabytes: 44.1,
    outputPath: "datasets/outputs/respostas2.json",
    records: 986,
    rssMegabytes: 97.8,
    timestamps: 742,
  },
  {
    dataset: "dataset3.txt",
    elapsedSeconds: 1.12,
    heapUsedMegabytes: 46.3,
    outputPath: "datasets/outputs/respostas3.json",
    records: 1532,
    rssMegabytes: 99.1,
    timestamps: 1106,
  },
];

const formatDemoDatasetSummary = (summary: DemoDatasetSummary, encounters: Encounter[]): string => {
  const counts = {
    faccao: encounters.filter((encounter) => encounter.tipo === "faccao").length,
    generico: encounters.filter((encounter) => encounter.tipo === "generico").length,
    protetiva: encounters.filter((encounter) => encounter.tipo === "protetiva").length,
  };
  const number = new Intl.NumberFormat("en-US");

  return [
    "SPACECOM ENCOUNTER ANALYZER",
    "────────────────────────────────────",
    "",
    `Dataset: ${summary.dataset}`,
    "",
    `Records processed:       ${number.format(summary.records)}`,
    `Unique timestamps:       ${number.format(summary.timestamps)}`,
    "",
    `Encounters detected:     ${number.format(encounters.length)}`,
    "",
    `Generic encounters:      ${number.format(counts.generico)}`,
    `Faction encounters:      ${number.format(counts.faccao)}`,
    `Protective encounters:   ${number.format(counts.protetiva)}`,
    "",
    `Execution time:          ${summary.elapsedSeconds.toFixed(2)} s`,
    `Heap used:               ${summary.heapUsedMegabytes.toFixed(1)} MB`,
    `Memory (RSS):            ${summary.rssMegabytes.toFixed(1)} MB`,
    "",
    `Output: ${summary.outputPath}`,
    "",
    "Status: SUCCESS",
  ].join("\n");
};

export const demoCliHeader = [
  "SPACECOM ENCOUNTER ANALYZER",
  "────────────────────────────────────",
].join("\n");

export const demoCliDatasetOutputs = (outputDirectory: string) =>
  demoDatasetSummaries.map((summary, datasetIndex) => {
    const datasetEncounters = demoEncounters.slice(datasetIndex * 4, (datasetIndex + 1) * 4);
    const outputFileName = summary.outputPath.replace(/^.*[\\/]/u, "");
    const outputPath = `${outputDirectory.replace(/[\\/]+$/u, "")}/${outputFileName}`;

    return {
      dataset: summary.dataset,
      durationMs: Math.round(summary.elapsedSeconds * 1000),
      output: formatDemoDatasetSummary({ ...summary, outputPath }, datasetEncounters),
    };
  });
