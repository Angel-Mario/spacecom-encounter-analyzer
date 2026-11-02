import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import AnalysisSettingsPanel from "./components/analysis-settings-panel";
import AppHeader from "./components/app-header";
import OverviewBanner from "./components/overview-banner";
import StatusBar from "./components/status-bar";
import WorkspacePanel from "./components/workspace-panel";
import { getInitialLocale, getLocaleCopy } from "./i18n";
import type { Locale } from "./i18n";
import { demoCliDatasetOutputs, demoCliHeader, demoEncounters } from "./mock-data";
import type { AnalysisResult, AnalysisStats, DefaultDirectories, Encounter } from "./types";

import "./App.css";
import "./styles/chrome.css";
import "./styles/dashboard.css";
import "./styles/layout.css";
import "./styles/panels.css";
import "./styles/workspace.css";

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
  fontWeightMedium: 600,
  fontWeightRegular: 500,
  fontWeightSemibold: 700,
};

const App = () => {
  const isDesktopApp = isTauri();
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [inputDirectory, setInputDirectory] = useState("datasets/inputs");
  const [outputDirectory, setOutputDirectory] = useState("datasets/outputs");
  const [analysisState, setAnalysisState] = useState<"ready" | "running" | "complete" | "error">(
    "ready",
  );
  const [analysisOutput, setAnalysisOutput] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [demoDatasetIndex, setDemoDatasetIndex] = useState<number | null>(null);
  const demoStartedAtRef = useRef<number | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>(isDesktopApp ? [] : demoEncounters);
  const desktopOnly = !isDesktopApp;
  const copy = getLocaleCopy(locale);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
    window.localStorage.setItem("spacecom-locale", locale);
  }, [locale]);

  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const { inputDirectory: defaultInputDirectory, outputDirectory: defaultOutputDirectory } =
          await invoke<DefaultDirectories>("get_default_directories");
        if (isMounted) {
          setInputDirectory(defaultInputDirectory);
          setOutputDirectory(defaultOutputDirectory);
        }
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setAnalysisError(`${copy.analysisFailed}: ${message}`);
        setAnalysisState("error");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [copy.analysisFailed, isDesktopApp]);

  useEffect(() => {
    if (isDesktopApp || analysisState !== "running" || demoDatasetIndex === null) {
      return;
    }

    const datasetOutputs = demoCliDatasetOutputs(outputDirectory);
    const datasetOutput = datasetOutputs[demoDatasetIndex];
    if (!datasetOutput) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAnalysisOutput((currentOutput) => `${currentOutput}\n\n${datasetOutput.output}`);

      const nextDataset = datasetOutputs[demoDatasetIndex + 1];
      if (nextDataset) {
        setAnalysisOutput(
          (currentOutput) =>
            `${currentOutput}\n\n${getLocaleCopy(locale).demoProcessingDataset(nextDataset.dataset)}`,
        );
        setDemoDatasetIndex(demoDatasetIndex + 1);
      } else {
        setDemoDatasetIndex(null);
        setAnalysisState("complete");
        setAnalysisStats({
          datasets: datasetOutputs.length,
          durationMs: Math.max(Math.round(performance.now() - (demoStartedAtRef.current ?? 0)), 1),
          rowsProcessed: demoEncounters.length,
        });
        demoStartedAtRef.current = null;
      }
    }, datasetOutput.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [analysisState, demoDatasetIndex, isDesktopApp, locale, outputDirectory]);

  const chooseDirectory = async (target: "input" | "output") => {
    try {
      const selectedDirectory = await open({
        directory: true,
        multiple: false,
        title: target === "input" ? copy.selectInputFolder : copy.selectOutputFolder,
      });

      if (typeof selectedDirectory !== "string") {
        return;
      }

      if (target === "input") {
        setInputDirectory(selectedDirectory);
      } else {
        setOutputDirectory(selectedDirectory);
      }

      setAnalysisState("ready");
      setAnalysisOutput("");
      setAnalysisError("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalysisState("error");
      setAnalysisError(`${copy.analysisFailed}: ${message}`);
    }
  };

  const runAnalysis = async () => {
    setAnalysisState("running");
    setAnalysisError("");
    setAnalysisStats(null);
    demoStartedAtRef.current = performance.now();

    if (!isDesktopApp) {
      const datasetOutputs = demoCliDatasetOutputs(outputDirectory);
      const [firstDataset] = datasetOutputs;
      if (!firstDataset) {
        setAnalysisError(copy.analysisFailed);
        setAnalysisState("error");
        return;
      }

      setEncounters(demoEncounters);
      setAnalysisOutput(`${demoCliHeader}\n\n${copy.demoProcessingDataset(firstDataset.dataset)}`);
      setDemoDatasetIndex(0);
      return;
    }

    setAnalysisOutput("");
    setEncounters([]);

    let stopListening: (() => void) | undefined;

    try {
      setAnalysisOutput(copy.analysisStarting);
      stopListening = await listen<string>("analysis-output", (event) => {
        setAnalysisOutput((currentOutput) =>
          currentOutput ? `${currentOutput}\n${event.payload}` : event.payload,
        );
      });

      const result = await invoke<AnalysisResult>("run_analysis", {
        inputDirectory,
        outputDirectory,
      });
      setAnalysisOutput(result.output);
      setEncounters(result.encounters);
      setAnalysisStats(result.stats);
      setAnalysisState("complete");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalysisError(message);
      setAnalysisOutput((currentOutput) => `${currentOutput}\n\n${message}`.trim());
      setAnalysisState("error");
    } finally {
      stopListening?.();
    }
  };

  const revealDirectory = async (target: "input" | "output") => {
    const directory = target === "input" ? inputDirectory : outputDirectory;

    try {
      await invoke("reveal_directory", { directory });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalysisError(`${copy.revealInExplorerFailed}: ${message}`);
    }
  };

  let statusMessage = copy.analysisReady;

  if (analysisState === "running") {
    statusMessage = copy.analysisRunning;
  } else if (analysisState === "complete") {
    statusMessage = copy.analysisComplete;
  } else if (analysisState === "error") {
    statusMessage = copy.analysisFailed;
  } else if (desktopOnly) {
    statusMessage = copy.demoDataStatus;
  }

  return (
    <FluentProvider theme={spacecomTheme}>
      <div className="app-shell">
        <AppHeader
          copy={copy}
          isDesktopApp={isDesktopApp}
          locale={locale}
          onLocaleChange={setLocale}
        />
        <main className="dashboard-main">
          <section className="overview-row" aria-label={copy.overviewLabel}>
            <OverviewBanner copy={copy} />
          </section>
          <section className="workbench" aria-label={copy.workspaceLabel}>
            <aside className="setup-column">
              <AnalysisSettingsPanel
                copy={copy}
                desktopOnly={desktopOnly}
                errorMessage={analysisError}
                inputDirectory={inputDirectory}
                isRunning={analysisState === "running"}
                onChooseInputDirectory={() => chooseDirectory("input")}
                onChooseOutputDirectory={() => chooseDirectory("output")}
                onRevealDirectory={revealDirectory}
                onRunAnalysis={runAnalysis}
                outputDirectory={outputDirectory}
                statusMessage={statusMessage}
              />
            </aside>
            <WorkspacePanel
              copy={copy}
              encounters={encounters}
              isAnalysisRunning={analysisState === "running"}
              isMockData={desktopOnly}
              output={analysisOutput}
              statusMessage={statusMessage}
            />
          </section>
        </main>
        <StatusBar
          copy={copy}
          encounterCount={encounters.length}
          locale={locale}
          stats={analysisStats}
          statusMessage={statusMessage}
        />
      </div>
    </FluentProvider>
  );
};

export default App;
