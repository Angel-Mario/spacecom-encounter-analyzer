import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { useEffect, useState } from "react";

import AnalysisSettingsPanel from "./components/analysis-settings-panel";
import AppHeader from "./components/app-header";
import DatasetImportPanel from "./components/dataset-import-panel";
import OverviewBanner from "./components/overview-banner";
import StatusBar from "./components/status-bar";
import WorkspacePanel from "./components/workspace-panel";
import { getInitialLocale, getLocaleCopy } from "./i18n";
import type { Locale, UploadMessage } from "./i18n";
import type { AnalysisSettings, ResultFilter, WorkspaceView } from "./types";
import { getFileKey } from "./utils/file-utils";

import "./App.css";
import "./styles/chrome.css";
import "./styles/dashboard.css";
import "./styles/illustrations.css";
import "./styles/layout.css";
import "./styles/panels.css";
import "./styles/workspace.css";

const initialSettings: AnalysisSettings = {
  distance: "20",
  monitor: "all",
  timestamp: "all",
};

const spacecomTheme = {
  ...webLightTheme,
  colorBrandBackground: "#FE040C",
  colorBrandBackgroundHover: "#D9040B",
  colorBrandBackgroundPressed: "#B80309",
  colorBrandBackgroundSelected: "#D9040B",
  colorBrandForeground1: "#C70008",
  colorBrandForeground2: "#A90007",
  colorBrandForegroundInverted: "#FFFFFF",
  colorBrandStroke1: "#FE040C",
  colorBrandStroke2: "#D9040B",
  colorCompoundBrandBackground: "#FE040C",
  colorCompoundBrandBackgroundHover: "#D9040B",
  colorCompoundBrandBackgroundPressed: "#B80309",
  colorCompoundBrandForeground1: "#C70008",
  colorCompoundBrandForeground1Hover: "#A90007",
  colorCompoundBrandForeground1Pressed: "#870006",
  colorCompoundBrandStroke: "#FE040C",
  colorCompoundBrandStrokeHover: "#D9040B",
  colorCompoundBrandStrokePressed: "#B80309",
};

const App = () => {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage>("");
  const [activeView, setActiveView] = useState<WorkspaceView>("results");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [settings, setSettings] = useState<AnalysisSettings>(initialSettings);
  const copy = getLocaleCopy(locale);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
    window.localStorage.setItem("spacecom-locale", locale);
  }, [locale]);

  const addFiles = (selectedFiles: File[]) => {
    const textFiles = selectedFiles.filter((file) => /\.txt$/iu.test(file.name));
    const ignoredFiles = selectedFiles.length > textFiles.length;

    if (textFiles.length === 0) {
      setUploadMessage("invalid");
      return;
    }

    setFiles((currentFiles) => {
      const currentKeys = new Set(currentFiles.map(getFileKey));
      const newFiles = textFiles.filter((file) => {
        const key = getFileKey(file);

        if (currentKeys.has(key)) {
          return false;
        }

        currentKeys.add(key);
        return true;
      });

      return [...currentFiles, ...newFiles];
    });
    setUploadMessage(ignoredFiles ? "ignored" : "updated");
  };

  const removeFile = (fileToRemove: File) => {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => getFileKey(file) !== getFileKey(fileToRemove)),
    );
  };

  const updateSettings = (setting: Partial<AnalysisSettings>) => {
    setSettings((currentSettings) => ({ ...currentSettings, ...setting }));
  };

  return (
    <FluentProvider theme={spacecomTheme}>
      <div className="app-shell">
        <AppHeader locale={locale} onLocaleChange={setLocale} copy={copy} />
        <main className="dashboard-main">
          <section className="overview-row" aria-label={copy.overviewLabel}>
            <OverviewBanner fileCount={files.length} copy={copy} />
          </section>
          <section className="workbench" aria-label={copy.workspaceLabel}>
            <aside className="setup-column">
              <DatasetImportPanel
                copy={copy}
                files={files}
                onAddFiles={addFiles}
                onRemoveFile={removeFile}
                uploadMessage={uploadMessage}
              />
              <AnalysisSettingsPanel
                copy={copy}
                fileCount={files.length}
                onUpdate={updateSettings}
                settings={settings}
              />
            </aside>
            <WorkspacePanel
              activeView={activeView}
              copy={copy}
              fileCount={files.length}
              onChangeView={setActiveView}
              onSearchChange={setSearchValue}
              onSelectFilter={setResultFilter}
              resultFilter={resultFilter}
              searchValue={searchValue}
            />
          </section>
        </main>
        <StatusBar copy={copy} fileCount={files.length} settings={settings} />
      </div>
    </FluentProvider>
  );
};

export default App;
