import { Button, Card, Text, Tooltip } from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  FolderOpenRegular,
  PlayRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";

interface AnalysisSettingsPanelProps {
  copy: LocaleCopy;
  desktopOnly: boolean;
  inputDirectory: string;
  isRunning: boolean;
  onChooseInputDirectory: () => void;
  onChooseOutputDirectory: () => void;
  onRevealDirectory: (target: "input" | "output") => void;
  onRunAnalysis: () => void;
  outputDirectory: string;
  statusMessage: string;
  errorMessage: string;
}

const AnalysisSettingsPanel = ({
  copy,
  desktopOnly,
  inputDirectory,
  isRunning,
  onChooseInputDirectory,
  onChooseOutputDirectory,
  onRevealDirectory,
  onRunAnalysis,
  outputDirectory,
  statusMessage,
  errorMessage,
}: AnalysisSettingsPanelProps) => (
  <Card
    aria-label={copy.settingsLabel}
    className="panel settings-panel"
    id="analysis-settings-panel"
    tabIndex={-1}
  >
    <div className="panel-heading">
      <SettingsRegular aria-hidden="true" />
      <Text as="h2" weight="bold">
        {copy.settingsHeading}
      </Text>
    </div>

    <div className="directory-fields">
      <div className="directory-field">
        <Text as="h3" size={200} weight="semibold">
          {copy.inputDirectory}
        </Text>
        <div className="directory-path-row">
          <Text className="directory-path" title={inputDirectory}>
            {inputDirectory}
          </Text>
          <Tooltip content={copy.revealInExplorer} relationship="label">
            <Button
              appearance="subtle"
              aria-label={copy.revealInExplorer}
              disabled={isRunning || desktopOnly}
              icon={<FolderOpenRegular />}
              onClick={() => onRevealDirectory("input")}
              shape="square"
              size="small"
            />
          </Tooltip>
        </div>
        <Button
          disabled={isRunning || desktopOnly}
          icon={<FolderOpenRegular />}
          onClick={onChooseInputDirectory}
          size="small"
        >
          {copy.selectInputFolder}
        </Button>
      </div>

      <div className="directory-field">
        <Text as="h3" size={200} weight="semibold">
          {copy.outputDirectory}
        </Text>
        <div className="directory-path-row">
          <Text className="directory-path" title={outputDirectory}>
            {outputDirectory}
          </Text>
          <Tooltip content={copy.revealInExplorer} relationship="label">
            <Button
              appearance="subtle"
              aria-label={copy.revealInExplorer}
              disabled={isRunning || desktopOnly}
              icon={<FolderOpenRegular />}
              onClick={() => onRevealDirectory("output")}
              shape="square"
              size="small"
            />
          </Tooltip>
        </div>
        <Button
          disabled={isRunning || desktopOnly}
          icon={<FolderOpenRegular />}
          onClick={onChooseOutputDirectory}
          size="small"
        >
          {copy.selectOutputFolder}
        </Button>
      </div>
    </div>

    <Button
      appearance="primary"
      className="start-analysis-button"
      disabled={isRunning}
      icon={<PlayRegular />}
      onClick={onRunAnalysis}
    >
      {isRunning ? copy.analysisRunning : copy.startAnalysis}
    </Button>
    <Text
      aria-live={errorMessage ? "assertive" : "polite"}
      className={`settings-note${!errorMessage && statusMessage === copy.analysisComplete ? " settings-note-complete" : ""}`}
      role={errorMessage ? "alert" : "status"}
      size={100}
    >
      {!errorMessage && statusMessage === copy.analysisComplete ? (
        <CheckmarkCircleFilled aria-hidden="true" />
      ) : null}
      {errorMessage || (desktopOnly ? copy.demoAnalysisNotice : statusMessage)}
    </Text>
  </Card>
);

export default AnalysisSettingsPanel;
