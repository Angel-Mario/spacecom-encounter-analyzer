// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./app";
import type { AnalysisResult, DefaultDirectories } from "./types";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  listen: vi.fn(),
  openDirectory: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: mocks.isTauri,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.openDirectory,
}));

vi.mock("./components/app-header", () => ({
  default: ({
    locale,
    onLocaleChange,
  }: {
    locale: string;
    onLocaleChange: (locale: "es") => void;
  }) => (
    <button onClick={() => onLocaleChange("es")} type="button">
      {locale}
    </button>
  ),
}));

vi.mock("./components/analysis-settings-panel", () => ({
  default: ({
    copy,
    errorMessage,
    inputDirectory,
    isRunning,
    onChooseOutputDirectory,
    onChooseInputDirectory,
    onRunAnalysis,
    outputDirectory,
    statusMessage,
  }: {
    copy: {
      inputDirectory: string;
      outputDirectory: string;
      selectInputFolder: string;
      selectOutputFolder: string;
      startAnalysis: string;
      analysisRunning: string;
    };
    errorMessage: string;
    inputDirectory: string;
    isRunning: boolean;
    onChooseInputDirectory: () => void;
    onChooseOutputDirectory: () => void;
    onRunAnalysis: () => void;
    outputDirectory: string;
    statusMessage: string;
  }) => (
    <section>
      <output aria-label={copy.inputDirectory}>{inputDirectory}</output>
      <output aria-label={copy.outputDirectory}>{outputDirectory}</output>
      <button onClick={onChooseInputDirectory} type="button">
        {copy.selectInputFolder}
      </button>
      <button onClick={onChooseOutputDirectory} type="button">
        {copy.selectOutputFolder}
      </button>
      <button onClick={onRunAnalysis} type="button">
        {isRunning ? copy.analysisRunning : copy.startAnalysis}
      </button>
      <p role="status">{statusMessage}</p>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
    </section>
  ),
}));

vi.mock("./components/overview-banner", () => ({
  default: () => <div />,
}));

vi.mock("./components/status-bar", () => ({
  default: ({ statusMessage }: { statusMessage: string }) => <footer>{statusMessage}</footer>,
}));

vi.mock("./components/workspace-panel", () => ({
  default: ({ output }: { output: string }) => <pre>{output}</pre>,
}));

const directories: DefaultDirectories = {
  inputDirectory: "C:\\datasets\\inputs",
  outputDirectory: "C:\\datasets\\outputs",
};

const analysisResult: AnalysisResult = {
  encounters: [],
  output: "Analysis finished successfully",
  stats: { datasets: 1, durationMs: 120, rowsProcessed: 25 },
};

const stopListening = vi.fn();

describe("desktop app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "get_default_directories") {
        return Promise.resolve(directories);
      }

      return Promise.resolve(analysisResult);
    });
    mocks.listen.mockResolvedValue(stopListening);
    mocks.openDirectory.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the default input and output directories", async () => {
    render(<App />);

    const inputDirectory = await screen.findByLabelText("Input folder");
    expect(inputDirectory.textContent).toContain(directories.inputDirectory);
    expect(screen.getByLabelText("Output folder").textContent).toContain(
      directories.outputDirectory,
    );
    expect(mocks.invoke).toHaveBeenCalledWith("get_default_directories");
  });

  it("streams CLI output and shows the completed analysis result", async () => {
    const user = userEvent.setup();
    let resolveAnalysis: ((result: AnalysisResult) => void) | undefined;
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "get_default_directories") {
        return Promise.resolve(directories);
      }

      // Keep analysis pending to verify streamed output before completion.
      // oxlint-disable-next-line promise/avoid-new
      return new Promise<AnalysisResult>((resolve) => {
        resolveAnalysis = resolve;
      });
    });

    render(<App />);
    await screen.findByLabelText("Input folder");
    await user.click(screen.getByRole("button", { name: "Start analysis" }));
    await waitFor(() => expect(mocks.listen).toHaveBeenCalled());

    const onOutput = mocks.listen.mock.calls[0]?.[1] as
      | ((event: { payload: string }) => void)
      | undefined;
    expect(onOutput).toBeDefined();

    act(() => onOutput?.({ payload: "Processing dataset1.txt" }));
    expect(screen.getByText(/Processing dataset1\.txt/u)).toBeDefined();

    act(() => resolveAnalysis?.(analysisResult));
    expect(await screen.findByText(analysisResult.output)).toBeDefined();
    expect(stopListening).toHaveBeenCalledOnce();
  });

  it("reports analysis failures and stops listening", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "get_default_directories") {
        return Promise.resolve(directories);
      }

      return Promise.reject(new Error("CLI exited unexpectedly"));
    });

    render(<App />);
    await screen.findByLabelText("Input folder");
    await user.click(screen.getByRole("button", { name: "Start analysis" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("CLI exited unexpectedly");
    expect(stopListening).toHaveBeenCalledOnce();
  });

  it("reports failures when loading the default directories", async () => {
    mocks.invoke.mockRejectedValue(new Error("Data directory unavailable"));
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Analysis failed: Data directory unavailable");
    expect(screen.getByLabelText("Input folder").textContent).toContain("datasets/inputs");
  });

  it("does not start analysis if subscribing to output events fails", async () => {
    const user = userEvent.setup();
    mocks.listen.mockRejectedValue(new Error("Event channel unavailable"));
    render(<App />);
    await screen.findByLabelText("Input folder");

    await user.click(screen.getByRole("button", { name: "Start analysis" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Event channel unavailable");
    expect(mocks.invoke).not.toHaveBeenCalledWith("run_analysis", expect.anything());
    expect(stopListening).not.toHaveBeenCalled();
  });

  it("updates the selected input folder", async () => {
    const user = userEvent.setup();
    mocks.openDirectory.mockResolvedValue("C:\\custom\\inputs");

    render(<App />);
    await screen.findByLabelText("Input folder");
    await user.click(screen.getByRole("button", { name: "Choose input folder" }));

    const inputDirectory = await screen.findByLabelText("Input folder");
    expect(inputDirectory.textContent).toContain("C:\\custom\\inputs");
    expect(mocks.openDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ directory: true, multiple: false }),
    );
  });

  it("updates the selected output folder", async () => {
    const user = userEvent.setup();
    mocks.openDirectory.mockResolvedValue("C:\\custom\\outputs");

    render(<App />);
    await screen.findByLabelText("Output folder");
    await user.click(screen.getByRole("button", { name: "Choose output folder" }));

    const outputDirectory = await screen.findByLabelText("Output folder");
    expect(outputDirectory.textContent).toContain("C:\\custom\\outputs");
    expect(mocks.openDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ directory: true, multiple: false }),
    );
  });

  it("keeps the input folder unchanged when the folder picker is cancelled", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Input folder");
    await user.click(screen.getByRole("button", { name: "Choose input folder" }));

    expect(screen.getByLabelText("Input folder").textContent).toContain(directories.inputDirectory);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports errors from the folder picker", async () => {
    const user = userEvent.setup();
    mocks.openDirectory.mockRejectedValue(new Error("Folder picker unavailable"));
    render(<App />);
    await screen.findByLabelText("Input folder");
    await user.click(screen.getByRole("button", { name: "Choose input folder" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Analysis failed: Folder picker unavailable");
  });

  it("persists the selected locale", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "en" }));
    await waitFor(() => {
      expect(window.localStorage.getItem("spacecom-locale")).toBe("es");
      expect(document.documentElement.lang).toBe("es");
    });
  });
});
