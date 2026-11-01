import { Button, Card, Input, Tab, TabList, Text } from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  ChartMultipleFilled,
  ChevronLeftRegular,
  ChevronRightRegular,
  CodeFilled,
  CodeRegular,
  ListFilled,
  ListRegular,
  MapFilled,
  MapRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type { LocaleCopy } from "../i18n";
import type { Encounter, EncounterType } from "../types";
import EncounterMap from "./encounter-map";

type WorkspaceTab = "results" | "map" | "details" | "cli";
type ResultFilter = "all" | EncounterType;

interface WorkspacePanelProps {
  copy: LocaleCopy;
  encounters: Encounter[];
  isAnalysisRunning: boolean;
  isMockData: boolean;
  output: string;
  statusMessage: string;
}

const PAGE_SIZE = 10;

const mapTypeClass = (type: EncounterType): string => `map-type-${type}`;

const encounterTypeLabels = (copy: LocaleCopy, type: EncounterType): string => {
  if (type === "faccao") {
    return copy.faction;
  }
  if (type === "protetiva") {
    return copy.protective;
  }
  return copy.generic;
};

const formatDistance = (distance: number): string =>
  `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(distance)} m`;

const handleEncounterRowKeyDown = (
  event: KeyboardEvent<HTMLTableRowElement>,
  onSelect: () => void,
) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onSelect();
};

const ExportErrorNotice = ({ message }: { message: string }) =>
  message ? (
    <Text aria-live="assertive" role="alert" size={200}>
      {message}
    </Text>
  ) : null;

const downloadTextFile = (content: string) => {
  const file = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  try {
    link.href = url;
    link.download = "spacecom-encounters.txt";
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

const WorkspacePanel = ({
  copy,
  encounters,
  isAnalysisRunning,
  isMockData,
  output,
  statusMessage,
}: WorkspacePanelProps) => {
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("results");
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedEncounterIndex, setSelectedEncounterIndex] = useState(0);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (isAnalysisRunning) {
      setSelectedTab("cli");
    }
  }, [isAnalysisRunning]);

  const filteredEncounters = useMemo(() => {
    const query = searchValue.trim().toLocaleLowerCase();
    return encounters
      .map((encounter, index) => ({ encounter, index }))
      .filter(
        ({ encounter }) =>
          (filter === "all" || encounter.tipo === filter) &&
          (!query ||
            encounter.monitoradosEncontro.some((id) => String(id).includes(query)) ||
            encounter.timestamp.toLocaleLowerCase().includes(query)),
      );
  }, [encounters, filter, searchValue]);

  const pageCount = Math.ceil(filteredEncounters.length / PAGE_SIZE);
  const displayedPage = Math.min(currentPage, Math.max(pageCount - 1, 0));
  const visibleEncounters = filteredEncounters.slice(
    displayedPage * PAGE_SIZE,
    (displayedPage + 1) * PAGE_SIZE,
  );
  const activeSelectedEncounterIndex =
    filteredEncounters.find(({ index }) => index === selectedEncounterIndex)?.index ??
    filteredEncounters[0]?.index;
  const selectedEncounter =
    activeSelectedEncounterIndex === undefined
      ? undefined
      : encounters[activeSelectedEncounterIndex];
  const mapPoints = useMemo(() => {
    const rawPoints = filteredEncounters.flatMap(
      ({ encounter, index: encounterIndex }, displayIndex) => {
        const positions = Object.entries(encounter.posicoes).filter(
          ([, coordinates]) =>
            Number.isFinite(coordinates.lat) &&
            coordinates.lat >= -90 &&
            coordinates.lat <= 90 &&
            Number.isFinite(coordinates.lon) &&
            coordinates.lon >= -180 &&
            coordinates.lon <= 180,
        );
        if (positions.length === 0) {
          return [];
        }

        const latitude = positions.reduce((sum, [, coordinates]) => sum + coordinates.lat, 0);
        const longitude = positions.reduce((sum, [, coordinates]) => sum + coordinates.lon, 0);

        return [
          {
            displayIndex: displayIndex + 1,
            distanceMeters: encounter.distanciaMetros,
            encounterIndex,
            encounterType: encounter.tipo,
            lat: latitude / positions.length,
            lon: longitude / positions.length,
            monitorIds: positions.map(([monitorId]) => monitorId).join(" · "),
            timestamp: encounter.timestamp,
          },
        ];
      },
    );

    return rawPoints;
  }, [filteredEncounters]);

  const selectTab = (_event: unknown, data: { value: unknown }) => {
    if (
      data.value === "results" ||
      data.value === "map" ||
      data.value === "details" ||
      data.value === "cli"
    ) {
      setSelectedTab(data.value);
    }
  };

  const changeFilter = (nextFilter: ResultFilter) => {
    setFilter(nextFilter);
    setCurrentPage(0);
  };

  const downloadResults = async () => {
    try {
      const report = filteredEncounters
        .map(({ encounter }, index) => {
          const positions = Object.entries(encounter.posicoes).map(
            ([monitorId, coordinates]) =>
              `${copy.monitors} ${monitorId}: ${copy.latitude} ${coordinates.lat}, ${copy.longitude} ${coordinates.lon}`,
          );
          return [
            `${copy.encounterDetails} ${index + 1}`,
            `${copy.type}: ${encounterTypeLabels(copy, encounter.tipo)}`,
            `${copy.monitorIds}: ${encounter.monitoradosEncontro.join(" · ")}`,
            `${copy.timestamp}: ${encounter.timestamp}`,
            `${copy.distanceMeters}: ${formatDistance(encounter.distanciaMetros)}`,
            ...positions,
          ].join("\n");
        })
        .join("\n\n");
      const content = `${copy.resultsHeading}\n${copy.showingEncounters(filteredEncounters.length)}\n\n${report}\n`;
      if (isTauri()) {
        const path = await save({
          defaultPath: "spacecom-encounters.txt",
          filters: [{ extensions: ["txt"], name: "TXT" }],
        });

        if (path === null) {
          return;
        }

        await invoke("export_report", { content, path });
      } else {
        downloadTextFile(content);
      }

      setExportError("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(`${copy.exportFailed}: ${message}`);
    }
  };

  const renderMap = () => {
    if (mapPoints.length === 0) {
      return (
        <div className="workspace-empty">
          <MapRegular aria-hidden="true" />
          <Text weight="semibold">{copy.noMapResults}</Text>
          <Text size={200}>{copy.importToVisualize}</Text>
        </div>
      );
    }

    const selectedMapEncounter = filteredEncounters.find(
      ({ index }) => index === activeSelectedEncounterIndex,
    )?.encounter;
    return (
      <div className="map-view">
        <div className="map-toolbar">
          <div className="map-legend">
            <Text as="h2" size={400} weight="bold">
              {copy.mapHeading}
            </Text>
            <Text size={200}>{copy.mapDescription}</Text>
          </div>
        </div>
        <div aria-label={copy.mapLegend} className="map-type-legend" role="list">
          {(
            [
              ["generico", copy.generic],
              ["faccao", copy.faction],
              ["protetiva", copy.protective],
            ] as const
          ).map(([type, label]) => (
            <span className="map-legend-item" key={type} role="listitem">
              <span aria-hidden="true" className={`map-legend-swatch ${mapTypeClass(type)}`} />
              {label}
              <span className="map-legend-count">
                {mapPoints.filter((point) => point.encounterType === type).length}
              </span>
            </span>
          ))}
        </div>
        <EncounterMap
          copy={copy}
          onSelectEncounter={setSelectedEncounterIndex}
          points={mapPoints}
          selectedEncounterIndex={activeSelectedEncounterIndex}
        />
        <div aria-label={copy.mapSelection} className="map-selection" role="status">
          {selectedMapEncounter ? (
            <>
              <div>
                <Text className="map-selection-label" size={100}>
                  {copy.monitors}
                </Text>
                <Text size={200}>{selectedMapEncounter.monitoradosEncontro.join(" · ")}</Text>
              </div>
              <div>
                <Text className="map-selection-label" size={100}>
                  {copy.timestamp}
                </Text>
                <Text size={200}>{selectedMapEncounter.timestamp}</Text>
              </div>
              <div>
                <Text className="map-selection-label" size={100}>
                  {copy.distanceMeters}
                </Text>
                <Text size={200}>{formatDistance(selectedMapEncounter.distanciaMetros)}</Text>
              </div>
              <span className={`map-selection-type ${mapTypeClass(selectedMapEncounter.tipo)}`}>
                {encounterTypeLabels(copy, selectedMapEncounter.tipo)}
              </span>
            </>
          ) : (
            <Text size={200}>{copy.selectEncounter}</Text>
          )}
        </div>
        <div className="map-caption">
          <Text size={200}>{copy.localView}</Text>
          <Text size={200}>{copy.showingEncounters(mapPoints.length)}</Text>
        </div>
      </div>
    );
  };

  const renderDetails = () => {
    if (!selectedEncounter) {
      return (
        <div className="workspace-empty">
          <ListRegular aria-hidden="true" />
          <Text weight="semibold">{copy.noSelection}</Text>
          <Text size={200}>{copy.chooseResult}</Text>
        </div>
      );
    }

    return (
      <div className="details-view">
        <div className="details-heading">
          <Text as="h2" size={400} weight="bold">
            {copy.encounterDetails}
          </Text>
          <Text size={200}>{encounterTypeLabels(copy, selectedEncounter.tipo)}</Text>
        </div>
        <dl className="details-grid">
          <div>
            <dt>{copy.monitorIds}</dt>
            <dd>{selectedEncounter.monitoradosEncontro.join(" · ")}</dd>
          </div>
          <div>
            <dt>{copy.timestamp}</dt>
            <dd>{selectedEncounter.timestamp}</dd>
          </div>
          <div>
            <dt>{copy.distanceMeters}</dt>
            <dd>{formatDistance(selectedEncounter.distanciaMetros)}</dd>
          </div>
          {Object.entries(selectedEncounter.posicoes).map(([monitorId, coordinates]) => (
            <div key={monitorId}>
              <dt>
                {copy.monitors} {monitorId}
              </dt>
              <dd>
                {copy.latitude}: {coordinates.lat}, {copy.longitude}: {coordinates.lon}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const renderResults = () => (
    <>
      <div className="results-toolbar">
        <div className="result-filters" aria-label={copy.filterResults}>
          {(
            [
              ["all", copy.all],
              ["generico", copy.generic],
              ["faccao", copy.faction],
              ["protetiva", copy.protective],
            ] as const
          ).map(([value, label]) => (
            <Button
              appearance={filter === value ? "primary" : "secondary"}
              key={value}
              onClick={() => changeFilter(value)}
              size="small"
            >
              {label}
              {value === "all"
                ? ` (${encounters.length})`
                : ` (${encounters.filter((encounter) => encounter.tipo === value).length})`}
            </Button>
          ))}
        </div>
        <Input
          aria-label={copy.searchResults}
          className="results-search"
          contentBefore={<SearchRegular aria-hidden="true" />}
          onChange={(_, data) => {
            setSearchValue(data.value);
            setCurrentPage(0);
          }}
          placeholder={copy.searchPlaceholder}
          value={searchValue}
        />
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">{copy.type}</th>
              <th scope="col">{copy.monitorIds}</th>
              <th scope="col">{copy.timestamp}</th>
              <th scope="col">{copy.distanceMeters}</th>
            </tr>
          </thead>
          <tbody>
            {visibleEncounters.map(({ encounter, index }) => (
              <tr
                aria-selected={index === activeSelectedEncounterIndex}
                className={index === activeSelectedEncounterIndex ? "is-selected" : undefined}
                key={`${encounter.timestamp}-${encounter.monitoradosEncontro.join("-")}-${index}`}
                onClick={() => setSelectedEncounterIndex(index)}
                onKeyDown={(event) =>
                  handleEncounterRowKeyDown(event, () => setSelectedEncounterIndex(index))
                }
                tabIndex={0}
              >
                <td>{encounterTypeLabels(copy, encounter.tipo)}</td>
                <td>{encounter.monitoradosEncontro.join(" · ")}</td>
                <td>{encounter.timestamp}</td>
                <td>{formatDistance(encounter.distanciaMetros)}</td>
              </tr>
            ))}
            {visibleEncounters.length === 0 ? (
              <tr>
                <td className="results-no-match" colSpan={4}>
                  {encounters.length === 0 ? copy.noResultsDescription : copy.noFilteredResults}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="results-footer">
        <Text size={200}>{copy.showingEncounters(filteredEncounters.length)}</Text>
        <div className="pagination-controls">
          <Button
            aria-label={copy.previousPage}
            disabled={displayedPage === 0}
            icon={<ChevronLeftRegular />}
            onClick={() => setCurrentPage(displayedPage - 1)}
            size="small"
          />
          <Text aria-live="polite" size={200}>
            {copy.page(pageCount === 0 ? 0 : displayedPage + 1)} / {pageCount}
          </Text>
          <Button
            aria-label={copy.nextPage}
            disabled={displayedPage >= pageCount - 1}
            icon={<ChevronRightRegular />}
            onClick={() => setCurrentPage(displayedPage + 1)}
            size="small"
          />
        </div>
      </div>
    </>
  );

  let cliStatusMessage = output ? statusMessage : copy.analysisOutputEmpty;
  if (isMockData && !output) {
    cliStatusMessage = copy.demoDataStatus;
  }

  return (
    <Card aria-label={copy.workspaceLabel} className="panel workspace-panel">
      <div className="workspace-toolbar">
        <TabList
          aria-label={copy.workspaceViews}
          onTabSelect={selectTab}
          selectedValue={selectedTab}
          size="medium"
        >
          <Tab
            aria-controls="workspace-tabpanel"
            icon={<ChartMultipleFilled aria-hidden="true" />}
            id="workspace-tab-results"
            value="results"
          >
            {copy.results}
          </Tab>
          <Tab
            aria-controls="workspace-tabpanel"
            icon={
              selectedTab === "map" ? (
                <MapFilled aria-hidden="true" />
              ) : (
                <MapRegular aria-hidden="true" />
              )
            }
            id="workspace-tab-map"
            value="map"
          >
            {copy.map}
          </Tab>
          <Tab
            aria-controls="workspace-tabpanel"
            icon={
              selectedTab === "details" ? (
                <ListFilled aria-hidden="true" />
              ) : (
                <ListRegular aria-hidden="true" />
              )
            }
            id="workspace-tab-details"
            value="details"
          >
            {copy.details}
          </Tab>
          <Tab
            aria-controls="workspace-tabpanel"
            icon={
              selectedTab === "cli" ? (
                <CodeFilled aria-hidden="true" />
              ) : (
                <CodeRegular aria-hidden="true" />
              )
            }
            id="workspace-tab-cli"
            value="cli"
          >
            {copy.analysisOutput}
          </Tab>
        </TabList>
        {isMockData ? (
          <Text className="demo-data-indicator" role="status" size={100}>
            {copy.demoDataLabel}
          </Text>
        ) : null}
        {selectedTab === "results" ? (
          <Button
            disabled={filteredEncounters.length === 0}
            icon={<ArrowDownloadRegular />}
            onClick={downloadResults}
            size="small"
          >
            {copy.export}
          </Button>
        ) : null}
      </div>
      <div
        aria-labelledby={`workspace-tab-${selectedTab}`}
        className="workspace-content"
        id="workspace-tabpanel"
        role="tabpanel"
        tabIndex={0}
      >
        {selectedTab === "results" ? (
          <>
            <div className="workspace-heading">
              <div className="workspace-status">
                <span
                  aria-hidden="true"
                  className={`status-indicator${statusMessage === copy.analysisFailed ? " is-error" : ""}`}
                />
                <Text size={200}>{statusMessage}</Text>
              </div>
              <Text as="h2" size={400} weight="bold">
                {copy.resultsHeading}
              </Text>
            </div>
            {renderResults()}
            <ExportErrorNotice message={exportError} />
          </>
        ) : null}
        {selectedTab === "map" ? renderMap() : null}
        {selectedTab === "details" ? renderDetails() : null}
        {selectedTab === "cli" ? (
          <>
            <div className="workspace-heading">
              <Text as="h2" size={400} weight="bold">
                {copy.analysisOutput}
              </Text>
              <Text size={200}>{cliStatusMessage}</Text>
            </div>
            {output ? (
              <pre aria-live="polite" className="cli-output">
                {output}
              </pre>
            ) : (
              <div className="cli-output-empty">
                <Text>{isAnalysisRunning ? copy.analysisRunning : copy.analysisInstructions}</Text>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Card>
  );
};

export default WorkspacePanel;
