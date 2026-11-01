import { Text } from "@fluentui/react-components";
import {
  CalendarLtrRegular,
  DatabaseRegular,
  FlashRegular,
  LocationRegular,
  PeopleTeamRegular,
} from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";
import type { AnalysisSettings } from "../types";

interface StatusBarProps {
  copy: LocaleCopy;
  fileCount: number;
  settings: AnalysisSettings;
}

const getMonitorLabel = (copy: LocaleCopy, value: string): string => {
  if (value === "with-coordinates") {
    return copy.withCoordinates;
  }

  if (value === "without-coordinates") {
    return copy.withoutCoordinates;
  }

  return copy.all;
};

const getTimestampLabel = (copy: LocaleCopy, value: string): string => {
  if (value === "invalid") {
    return copy.needsReview;
  }

  if (value === "valid") {
    return copy.valid;
  }

  return copy.all;
};

const StatusBar = ({ copy, fileCount, settings }: StatusBarProps) => (
  <footer className="status-bar">
    <div className="status-group">
      <div className="status-item status-ready" title={copy.loadedFiles}>
        <DatabaseRegular aria-hidden="true" />
        <Text size={100}>{copy.filesImported(fileCount)}</Text>
      </div>
      <div className="status-item" title={copy.configuredEncounterRadius}>
        <LocationRegular aria-hidden="true" />
        <Text size={100}>
          {copy.radius}: {settings.distance} m
        </Text>
      </div>
      <div className="status-item" title={copy.monitorFilter}>
        <PeopleTeamRegular aria-hidden="true" />
        <Text size={100}>
          {copy.monitors}: {getMonitorLabel(copy, settings.monitor)}
        </Text>
      </div>
      <div className="status-item" title={copy.timestampFilter}>
        <CalendarLtrRegular aria-hidden="true" />
        <Text size={100}>
          {copy.timestamp}: {getTimestampLabel(copy, settings.timestamp)}
        </Text>
      </div>
    </div>
    <div className="status-item status-runtime" title={copy.analysisEngine}>
      <FlashRegular aria-hidden="true" />
      <Text size={100}>{copy.analysisPending}</Text>
    </div>
  </footer>
);

export default StatusBar;
