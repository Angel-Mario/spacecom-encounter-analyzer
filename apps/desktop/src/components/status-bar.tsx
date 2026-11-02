import { Text } from "@fluentui/react-components";
import { FlashRegular } from "@fluentui/react-icons";

import type { Locale, LocaleCopy } from "../i18n";
import type { AnalysisStats } from "../types";

interface StatusBarProps {
  copy: LocaleCopy;
  encounterCount: number;
  locale: Locale;
  stats: AnalysisStats | null;
  statusMessage: string;
}

const formatDuration = (durationMs: number, locale: Locale): string => {
  const numberFormat = new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, {
    maximumFractionDigits: durationMs >= 1000 ? 2 : 0,
  });

  return durationMs >= 1000
    ? `${numberFormat.format(durationMs / 1000)} s`
    : `${numberFormat.format(durationMs)} ms`;
};

const StatusBar = ({ copy, encounterCount, locale, stats, statusMessage }: StatusBarProps) => {
  const metrics = stats
    ? [
        { label: copy.statusDatasets(stats.datasets), key: "datasets" },
        { label: copy.statusRows(stats.rowsProcessed), key: "rows" },
        { label: copy.statusEncounters(encounterCount), key: "encounters" },
        {
          label: copy.statusElapsed(formatDuration(stats.durationMs, locale)),
          key: "elapsed",
        },
      ]
    : [];

  return (
    <footer className="status-bar">
      <div className="status-item status-runtime" title={copy.analysisEngine}>
        <FlashRegular aria-hidden="true" />
        <Text size={100}>{statusMessage}</Text>
      </div>
      <div className="status-metrics">
        {metrics.map((metric) => (
          <div className="status-item" key={metric.key} title={metric.label}>
            <Text size={100}>{metric.label}</Text>
          </div>
        ))}
      </div>
    </footer>
  );
};

export default StatusBar;
