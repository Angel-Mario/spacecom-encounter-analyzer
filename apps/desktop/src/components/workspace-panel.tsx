import { Badge, Button, Card, Tab, TabList, Text } from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  ChartMultipleRegular,
  LocationRegular,
  MapRegular,
  PeopleRegular,
} from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";
import type { ResultFilter, WorkspaceView } from "../types";
import EncounterDetailsPanel from "./encounter-details-panel";
import MapPanel from "./map-panel";
import ResultsPanel from "./results-panel";

interface WorkspacePanelProps {
  activeView: WorkspaceView;
  copy: LocaleCopy;
  fileCount: number;
  onChangeView: (view: WorkspaceView) => void;
  onSearchChange: (value: string) => void;
  onSelectFilter: (filter: ResultFilter) => void;
  resultFilter: ResultFilter;
  searchValue: string;
}

const WorkspacePanel = ({
  activeView,
  copy,
  fileCount,
  onChangeView,
  onSearchChange,
  onSelectFilter,
  resultFilter,
  searchValue,
}: WorkspacePanelProps) => (
  <Card className="panel workspace-panel">
    <div className="workspace-toolbar">
      <TabList
        aria-label={copy.workspaceViews}
        className="workspace-tabs"
        onTabSelect={(_, data) => {
          if (data.value === "results" || data.value === "map" || data.value === "details") {
            onChangeView(data.value);
          }
        }}
        selectedValue={activeView}
        size="small"
      >
        <Tab
          aria-controls="results-panel"
          icon={<ChartMultipleRegular />}
          id="results-tab"
          value="results"
        >
          {copy.results}
        </Tab>
        <Tab aria-controls="map-panel" icon={<MapRegular />} id="map-tab" value="map">
          {copy.map}
        </Tab>
        <Tab
          aria-controls="details-panel"
          icon={<PeopleRegular />}
          id="details-tab"
          value="details"
        >
          {copy.details}
        </Tab>
      </TabList>
      <Button
        appearance="secondary"
        className="export-button"
        disabled
        icon={<ArrowDownloadRegular />}
        title={copy.exportUnavailable}
      >
        {copy.export}
      </Button>
    </div>

    <div className="workspace-status">
      <span className="workspace-status-indicator" />
      <Text size={100}>
        {fileCount > 0 ? copy.datasetsImported(fileCount) : copy.waitingForDatasets}
      </Text>
      <Badge appearance="tint" icon={<LocationRegular />}>
        {copy.localView}
      </Badge>
    </div>

    {activeView === "results" && (
      <ResultsPanel
        copy={copy}
        fileCount={fileCount}
        onSearchChange={onSearchChange}
        onSelectFilter={onSelectFilter}
        resultFilter={resultFilter}
        searchValue={searchValue}
      />
    )}
    {activeView === "map" && <MapPanel copy={copy} />}
    {activeView === "details" && <EncounterDetailsPanel copy={copy} />}
  </Card>
);

export default WorkspacePanel;
