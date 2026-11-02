// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocaleCopy } from "../i18n";
import { demoEncounters } from "../mock-data";
import type { Encounter } from "../types";
import WorkspacePanel from "./workspace-panel";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  openUrl: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: mocks.isTauri,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: mocks.save,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
}));

vi.mock("./encounter-map", () => ({
  default: ({ points }: { points: { encounterIndex: number }[] }) => (
    <div data-testid="map-points">{points.length}</div>
  ),
}));

const copy = getLocaleCopy("en");

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const renderWorkspace = (encounters: Encounter[] = demoEncounters) =>
  render(
    <WorkspacePanel
      copy={copy}
      encounters={encounters}
      isAnalysisRunning={false}
      isMockData={false}
      output=""
      statusMessage={copy.analysisReady}
    />,
  );

describe("workspace results", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    mocks.isTauri.mockReturnValue(false);
    mocks.invoke.mockReset();
    mocks.save.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("searches encounters by monitor ID", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByRole("textbox", { name: copy.searchResults }), "1042");

    expect(screen.getByRole("row", { name: /1042/u })).toBeDefined();
    expect(screen.queryByRole("row", { name: /2061/u })).toBeNull();
    expect(screen.getByText(copy.showingEncounters(1))).toBeDefined();
  });

  it("searches encounters by timestamp", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByRole("textbox", { name: copy.searchResults }), "09:42:15");

    expect(screen.getByRole("row", { name: /2061/u })).toBeDefined();
    expect(screen.queryByRole("row", { name: /1042/u })).toBeNull();
    expect(screen.getByText(copy.showingEncounters(1))).toBeDefined();
  });

  it("filters encounters by type", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Faction (4)" }));

    expect(screen.getByRole("row", { name: /2061/u })).toBeDefined();
    expect(screen.queryByRole("row", { name: /1042/u })).toBeNull();
    expect(screen.getByText(copy.showingEncounters(4))).toBeDefined();
  });

  it("combines the type filter with the search query", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Faction (4)" }));
    await user.type(screen.getByRole("textbox", { name: copy.searchResults }), "2217");

    expect(screen.getByRole("row", { name: /2217/u })).toBeDefined();
    expect(screen.queryByRole("row", { name: /2061/u })).toBeNull();
    expect(screen.getByText(copy.showingEncounters(1))).toBeDefined();
  });

  it("paginates through results", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByText("Page 1 / 2")).toBeDefined();
    await user.click(screen.getByRole("button", { name: copy.nextPage }));

    expect(screen.getByText("Page 2 / 2")).toBeDefined();
    expect(screen.getByRole("row", { name: /1811/u })).toBeDefined();
    expect(screen.queryByRole("row", { name: /1042/u })).toBeNull();
  });

  it("shows details for the selected encounter", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("row", { name: /2061/u }));
    await user.click(screen.getByRole("tab", { name: copy.details }));

    expect(screen.getByRole("heading", { name: copy.encounterDetails })).toBeDefined();
    expect(screen.getByText("2061 · 2094")).toBeDefined();
    expect(screen.getByText("2026-10-28 09:42:15")).toBeDefined();
  });

  it("selects an encounter with the keyboard", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const row = screen.getByRole("row", { name: /2061/u });
    row.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("tab", { name: copy.details }));

    expect(screen.getByText("2061 · 2094")).toBeDefined();
  });

  it("opens the selected encounter on the map from its details", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("row", { name: /2061/u }));
    await user.click(screen.getByRole("tab", { name: copy.details }));
    await user.click(screen.getByRole("button", { name: copy.viewOnMap }));

    expect(screen.getByTestId("map-points").textContent).toBe("1");
    expect(screen.getByRole("status", { name: copy.mapSelection }).textContent).toContain(
      "2061 · 2094",
    );
  });

  it("shows the empty state when no encounters are available", () => {
    renderWorkspace([]);

    expect(screen.getByText(copy.noResultsDescription)).toBeDefined();
    expect(screen.getByText(copy.showingEncounters(0))).toBeDefined();
    expect((screen.getByRole("button", { name: copy.export }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("exports the visible results through the Tauri save dialog", async () => {
    const user = userEvent.setup();
    mocks.isTauri.mockReturnValue(true);
    mocks.save.mockResolvedValue("C:\\exports\\encounters.txt");
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: copy.export }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith(
        "export_report",
        expect.objectContaining({
          content: expect.stringContaining("1042 · 1187"),
          path: "C:\\exports\\encounters.txt",
        }),
      );
    });
  });

  it("does not export when the save dialog is cancelled", async () => {
    const user = userEvent.setup();
    mocks.isTauri.mockReturnValue(true);
    mocks.save.mockResolvedValue(null);
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: copy.export }));

    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error when export fails", async () => {
    const user = userEvent.setup();
    mocks.isTauri.mockReturnValue(true);
    mocks.save.mockRejectedValue(new Error("Permission denied"));
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: copy.export }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Export failed: Permission denied");
  });
});
