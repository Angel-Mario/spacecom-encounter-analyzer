import { Button, Card, Select, Text } from "@fluentui/react-components";
import {
  CalendarLtrRegular,
  LocationRegular,
  PlayRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";
import type { AnalysisSettings } from "../types";

interface AnalysisSettingsPanelProps {
  copy: LocaleCopy;
  fileCount: number;
  onUpdate: (settings: Partial<AnalysisSettings>) => void;
  settings: AnalysisSettings;
}

const AnalysisSettingsPanel = ({
  copy,
  fileCount,
  onUpdate,
  settings,
}: AnalysisSettingsPanelProps) => (
  <Card
    aria-label={copy.settingsLabel}
    className="panel settings-panel"
    id="analysis-settings-panel"
    tabIndex={-1}
  >
    <div className="panel-heading">
      <span className="step-number">2</span>
      <SettingsRegular aria-hidden="true" />
      <Text as="h2" weight="semibold">
        {copy.settingsHeading}
      </Text>
    </div>

    <div className="settings-fields">
      <div className="setting-field">
        <label htmlFor="monitor-filter">
          <LocationRegular aria-hidden="true" />
          {copy.monitors} (ID)
        </label>
        <Select
          id="monitor-filter"
          onChange={(_, data) => onUpdate({ monitor: data.value })}
          size="small"
          value={settings.monitor}
        >
          <option value="all">{copy.all}</option>
          <option value="with-coordinates">{copy.withCoordinates}</option>
          <option value="without-coordinates">{copy.withoutCoordinates}</option>
        </Select>
      </div>

      <div className="setting-field">
        <label htmlFor="timestamp-filter">
          <CalendarLtrRegular aria-hidden="true" />
          {copy.timestamp}
        </label>
        <Select
          id="timestamp-filter"
          onChange={(_, data) => onUpdate({ timestamp: data.value })}
          size="small"
          value={settings.timestamp}
        >
          <option value="all">{copy.all}</option>
          <option value="valid">{copy.valid}</option>
          <option value="invalid">{copy.needsReview}</option>
        </Select>
      </div>

      <div className="setting-field distance-field">
        <label htmlFor="distance-filter">
          <LocationRegular aria-hidden="true" />
          {copy.distance}
        </label>
        <Select
          id="distance-filter"
          onChange={(_, data) => onUpdate({ distance: data.value })}
          size="small"
          value={settings.distance}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </Select>
      </div>
    </div>

    <Button
      appearance="primary"
      className="start-analysis-button"
      disabled
      icon={<PlayRegular />}
      title={fileCount === 0 ? copy.importToEnableAnalysis : copy.engineNotConnected}
    >
      {copy.startAnalysis}
    </Button>
    <Text className="settings-note" size={100}>
      {fileCount === 0 ? copy.importToPrepareAnalysis : copy.engineComingSoon}
    </Text>
  </Card>
);

export default AnalysisSettingsPanel;
