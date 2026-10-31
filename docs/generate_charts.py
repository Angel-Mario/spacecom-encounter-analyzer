"""
Generate performance charts for PERFORMANCE.md.
Run from the repo root:  py -3 docs/generate_charts.py
Output: docs/images/perf_*.png
"""

import matplotlib
matplotlib.use("Agg")  # headless – no display needed

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from pathlib import Path

OUT = Path(__file__).parent / "images"
OUT.mkdir(exist_ok=True)

# ── palette (dark-friendly) ──────────────────────────────────────────────────
C_BASELINE  = "#6b7280"   # gray-500
C_SPATIAL   = "#3b82f6"   # blue-500
C_CPU       = "#f59e0b"   # amber-500
C_PARALLEL  = "#22c55e"   # green-500
C_ACCENT    = "#a78bfa"   # violet-400
DARK_BG     = "#0f1117"
PANEL_BG    = "#1a1d27"
GRID_COLOR  = "#2d3045"
TEXT_COLOR  = "#e2e8f0"

DATASETS    = ["ds1", "ds2", "ds3", "ds4", "ds5", "ds6", "ds7"]
RECORDS     = [5_000, 25_000, 100_000, 400_020, 1_000_000, 8_000_000, 12_000_000]

BASELINE    = [0.08, 0.26, 1.08, 4.43, 12.20, 105.59, 191.23]
SPATIAL     = [0.08, 0.29, 0.99, 3.82,  9.50,  75.47, 115.50]
CPU_OPT     = [0.03, 0.09, 0.49, 1.82,  4.34,  34.84,  52.41]
PARALLEL    = [0.05, 0.16, 0.76, 1.65,  2.38,  14.59,  22.53]

def style_ax(ax):
    ax.set_facecolor(PANEL_BG)
    ax.tick_params(colors=TEXT_COLOR, labelsize=9)
    ax.xaxis.label.set_color(TEXT_COLOR)
    ax.yaxis.label.set_color(TEXT_COLOR)
    ax.title.set_color(TEXT_COLOR)
    for spine in ax.spines.values():
        spine.set_edgecolor(GRID_COLOR)
    ax.grid(axis="y", color=GRID_COLOR, linewidth=0.6, linestyle="--", alpha=0.7)
    ax.set_axisbelow(True)

def save(fig, name):
    fig.savefig(OUT / name, dpi=150, bbox_inches="tight",
                facecolor=DARK_BG, edgecolor="none")
    plt.close(fig)
    print(f"  saved {OUT / name}")


# ── 1. All-stages bar chart ──────────────────────────────────────────────────
def chart_all_stages():
    fig, ax = plt.subplots(figsize=(11, 5))
    fig.patch.set_facecolor(DARK_BG)
    style_ax(ax)

    x      = np.arange(len(DATASETS))
    width  = 0.20
    offsets = [-1.5, -0.5, 0.5, 1.5]
    data   = [BASELINE, SPATIAL, CPU_OPT, PARALLEL]
    colors = [C_BASELINE, C_SPATIAL, C_CPU, C_PARALLEL]
    labels = ["Baseline (O(n²))", "Spatial index", "CPU optimized", "Parallel workers"]

    for i, (vals, color, label) in enumerate(zip(data, colors, labels)):
        bars = ax.bar(x + offsets[i] * width, vals, width,
                      color=color, alpha=0.88, label=label, zorder=3)
        # value labels only on ds6/ds7 to avoid clutter
        for j, (bar, v) in enumerate(zip(bars, vals)):
            if j >= 5:
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                        f"{v:.0f}s", ha="center", va="bottom",
                        fontsize=7, color=color)

    ax.set_xticks(x)
    ax.set_xticklabels(DATASETS)
    ax.set_xlabel("Dataset", labelpad=8)
    ax.set_ylabel("Execution time (s)", labelpad=8)
    ax.set_title("Execution time by optimization stage", pad=12, fontsize=12, fontweight="bold")
    ax.legend(facecolor=PANEL_BG, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR,
              fontsize=9, loc="upper left")
    save(fig, "perf_all_stages.png")


# ── 2. Log-scale comparison (all datasets, all stages) ───────────────────────
def chart_log_scale():
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor(DARK_BG)
    style_ax(ax)
    ax.set_yscale("log")
    ax.grid(axis="both", color=GRID_COLOR, linewidth=0.6, linestyle="--", alpha=0.7)

    x      = np.arange(len(DATASETS))
    width  = 0.20
    offsets = [-1.5, -0.5, 0.5, 1.5]
    data   = [BASELINE, SPATIAL, CPU_OPT, PARALLEL]
    colors = [C_BASELINE, C_SPATIAL, C_CPU, C_PARALLEL]
    labels = ["Baseline", "Spatial index", "CPU optimized", "Parallel"]

    for i, (vals, color, label) in enumerate(zip(data, colors, labels)):
        ax.bar(x + offsets[i] * width, vals, width,
               color=color, alpha=0.88, label=label, zorder=3)

    ax.set_xticks(x)
    ax.set_xticklabels(DATASETS)
    ax.set_xlabel("Dataset", labelpad=8)
    ax.set_ylabel("Execution time (s)  [log scale]", labelpad=8)
    ax.set_title("Execution time – log scale (all datasets)", pad=12, fontsize=12, fontweight="bold")
    ax.legend(facecolor=PANEL_BG, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR,
              fontsize=9, loc="upper left")
    save(fig, "perf_log_scale.png")


# ── 3. Speedup vs baseline (ds4 – ds7) ───────────────────────────────────────
def chart_speedup():
    ds_labels   = ["ds4", "ds5", "ds6", "ds7"]
    idx         = [3, 4, 5, 6]
    speedups = {
        "Spatial index" : [BASELINE[i] / SPATIAL[i]  for i in idx],
        "CPU optimized" : [BASELINE[i] / CPU_OPT[i]  for i in idx],
        "Parallel"      : [BASELINE[i] / PARALLEL[i] for i in idx],
    }
    colors = [C_SPATIAL, C_CPU, C_PARALLEL]

    fig, ax = plt.subplots(figsize=(8, 5))
    fig.patch.set_facecolor(DARK_BG)
    style_ax(ax)

    x      = np.arange(len(ds_labels))
    width  = 0.24
    offsets = [-1, 0, 1]

    for i, (label, vals) in enumerate(speedups.items()):
        bars = ax.bar(x + offsets[i] * width, vals, width,
                      color=colors[i], alpha=0.88, label=label, zorder=3)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.05,
                    f"{v:.1f}×", ha="center", va="bottom",
                    fontsize=8, color=colors[i])

    ax.axhline(1.0, color=C_BASELINE, linewidth=1.2, linestyle="--",
               label="Baseline (1×)", zorder=2)
    ax.set_xticks(x)
    ax.set_xticklabels(ds_labels)
    ax.set_xlabel("Dataset", labelpad=8)
    ax.set_ylabel("Speedup vs baseline", labelpad=8)
    ax.set_title("Speedup vs baseline per optimization stage (ds4–ds7)",
                 pad=12, fontsize=12, fontweight="bold")
    ax.legend(facecolor=PANEL_BG, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR,
              fontsize=9)
    save(fig, "perf_speedup.png")


# ── 4. CPU profile breakdown: before vs after stage 2 ────────────────────────
def chart_cpu_profile():
    before_labels = [
        "Timestamp\nvalidation",
        "Encounter\ndetection",
        "Zod row\nrunner",
        "Record\nreader",
        "Row\nparser",
        "Zod\nparsing",
        "Spatial\nlookup",
        "Other",
    ]
    before_pct = [21.2, 20.2, 6.0, 5.8, 5.5, 4.9, 3.1, 33.3]

    after_labels = [
        "Encounter\ndetection",
        "parseDelimited\nRecord",
        "Spatial\nlookup",
        "CLI\naggregation",
        "Row field\ndispatch",
        "Async\niterator",
        "Coord field\nparsing",
        "Line reader\n& UTF-8",
        "Timestamp\ncheck",
        "Other",
    ]
    after_pct = [39.8, 8.7, 5.8, 5.8, 5.4, 4.5, 5.3, 5.9, 1.9, 16.9]

    highlight_before = ["#ef4444", "#f59e0b", "#ef4444", "#94a3b8",
                         "#94a3b8", "#ef4444", "#94a3b8", "#475569"]
    highlight_after  = ["#f59e0b", "#94a3b8", "#94a3b8", "#94a3b8",
                         "#94a3b8", "#94a3b8", "#94a3b8", "#94a3b8",
                         "#22c55e", "#475569"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    fig.patch.set_facecolor(DARK_BG)

    def draw_hbar(ax, labels, values, colors, title, total_time):
        ax.set_facecolor(PANEL_BG)
        y = np.arange(len(labels))
        bars = ax.barh(y, values, color=colors, alpha=0.88, zorder=3)
        ax.set_yticks(y)
        ax.set_yticklabels(labels, fontsize=8.5, color=TEXT_COLOR)
        ax.tick_params(colors=TEXT_COLOR, labelsize=9)
        ax.xaxis.label.set_color(TEXT_COLOR)
        ax.set_xlabel("% of sampled CPU time", labelpad=8)
        ax.set_title(f"{title}\n({total_time})", pad=10, fontsize=11,
                     fontweight="bold", color=TEXT_COLOR)
        for spine in ax.spines.values():
            spine.set_edgecolor(GRID_COLOR)
        ax.grid(axis="x", color=GRID_COLOR, linewidth=0.6, linestyle="--", alpha=0.7)
        ax.set_axisbelow(True)
        for bar, v in zip(bars, values):
            ax.text(v + 0.3, bar.get_y() + bar.get_height() / 2,
                    f"{v:.1f}%", va="center", fontsize=8, color=TEXT_COLOR)
        ax.invert_yaxis()

    draw_hbar(ax1, before_labels, before_pct, highlight_before,
              "Before CPU optimizations", "dataset 7, ~120 s profiled")
    draw_hbar(ax2, after_labels,  after_pct,  highlight_after,
              "After CPU optimizations",  "dataset 7, ~55 s profiled")

    # legend for color meaning
    red_patch   = mpatches.Patch(color="#ef4444", alpha=0.88, label="Eliminated by stage 2")
    amber_patch = mpatches.Patch(color="#f59e0b", alpha=0.88, label="Dominant / remaining")
    green_patch = mpatches.Patch(color="#22c55e", alpha=0.88, label="Reduced to negligible")
    fig.legend(handles=[red_patch, amber_patch, green_patch],
               loc="lower center", ncol=3, facecolor=PANEL_BG,
               edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=9,
               bbox_to_anchor=(0.5, -0.04))

    fig.suptitle("CPU profile breakdown: before vs after pipeline optimizations",
                 fontsize=13, fontweight="bold", color=TEXT_COLOR, y=1.02)
    save(fig, "perf_cpu_profile.png")


# ── 5. Stage-by-stage delta for ds6 + ds7 combined ───────────────────────────
def chart_ds67_delta():
    stages = ["Baseline", "Spatial\nindex", "CPU\noptimized", "Parallel\nworkers"]
    ds6    = [105.59, 75.47, 34.84, 14.59]
    ds7    = [191.23, 115.50, 52.41, 22.53]
    totals = [d6 + d7 for d6, d7 in zip(ds6, ds7)]

    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor(DARK_BG)
    style_ax(ax)

    x = np.arange(len(stages))
    w = 0.35
    b6 = ax.bar(x - w/2, ds6, w, label="dataset 6", color=C_SPATIAL,   alpha=0.88, zorder=3)
    b7 = ax.bar(x + w/2, ds7, w, label="dataset 7", color=C_PARALLEL,  alpha=0.88, zorder=3)

    # combined total annotation
    for i, (t, d6v, d7v) in enumerate(zip(totals, ds6, ds7)):
        ax.text(i, max(d6v, d7v) + 5, f"∑ {t:.0f}s",
                ha="center", va="bottom", fontsize=8.5, color=C_ACCENT, fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(stages, fontsize=10)
    ax.set_ylabel("Execution time (s)", labelpad=8)
    ax.set_title("Dataset 6 & 7 execution time across optimization stages",
                 pad=12, fontsize=12, fontweight="bold")
    ax.legend(facecolor=PANEL_BG, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=9)
    save(fig, "perf_ds67_delta.png")


# ── 6. Records vs time scatter (scaling behavior) ────────────────────────────
def chart_scaling():
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor(DARK_BG)
    style_ax(ax)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.grid(axis="both", color=GRID_COLOR, linewidth=0.6, linestyle="--", alpha=0.7)

    for vals, color, label, marker in [
        (BASELINE, C_BASELINE, "Baseline",       "o"),
        (SPATIAL,  C_SPATIAL,  "Spatial index",  "s"),
        (CPU_OPT,  C_CPU,      "CPU optimized",  "^"),
        (PARALLEL, C_PARALLEL, "Parallel",       "D"),
    ]:
        ax.plot(RECORDS, vals, marker=marker, color=color, linewidth=1.8,
                markersize=7, label=label, alpha=0.9, zorder=3)

    # ideal linear reference
    r_ref = np.array([RECORDS[0], RECORDS[-1]])
    scale = BASELINE[-1] / RECORDS[-1]
    ax.plot(r_ref, r_ref * scale, "--", color="#475569", linewidth=1,
            label="Linear (reference)", zorder=2)

    ax.set_xlabel("Records in dataset  [log scale]", labelpad=8)
    ax.set_ylabel("Execution time (s)  [log scale]", labelpad=8)
    ax.set_title("Scaling behavior: records vs time (log–log)",
                 pad=12, fontsize=12, fontweight="bold")
    ax.legend(facecolor=PANEL_BG, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=9)
    save(fig, "perf_scaling.png")


if __name__ == "__main__":
    print("Generating performance charts …")
    chart_all_stages()
    chart_log_scale()
    chart_speedup()
    chart_cpu_profile()
    chart_ds67_delta()
    chart_scaling()
    print("Done.")
