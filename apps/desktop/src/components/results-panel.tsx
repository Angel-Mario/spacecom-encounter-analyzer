import {
  Badge,
  Button,
  SearchBox,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";
import type { ResultFilter } from "../types";

interface ResultsPanelProps {
  copy: LocaleCopy;
  fileCount: number;
  onSearchChange: (value: string) => void;
  onSelectFilter: (filter: ResultFilter) => void;
  resultFilter: ResultFilter;
  searchValue: string;
}

const ResultsPanel = ({
  copy,
  fileCount,
  onSearchChange,
  onSelectFilter,
  resultFilter,
  searchValue,
}: ResultsPanelProps) => (
  <div
    id="results-panel"
    aria-labelledby="results-tab"
    className="workspace-view results-view"
    role="tabpanel"
    tabIndex={0}
  >
    <div className="results-toolbar">
      <div>
        <Text as="h2" size={400} weight="bold">
          {copy.resultsHeading}
        </Text>
        <Text size={200}>
          {fileCount > 0 ? copy.resultsWillBeAvailable : copy.importDatasetsToPrepare}
        </Text>
      </div>
      <div className="results-search">
        <SearchBox
          aria-label={copy.searchResults}
          contentBefore={<SearchRegular />}
          onChange={(_, data) => onSearchChange(data.value)}
          placeholder={copy.searchPlaceholder}
          value={searchValue}
        />
      </div>
    </div>

    <div aria-label={copy.filterResults} className="result-filters" role="group">
      <Button
        aria-pressed={resultFilter === "all"}
        className="result-filter-button"
        onClick={() => onSelectFilter("all")}
        appearance={resultFilter === "all" ? "primary" : "subtle"}
        size="small"
      >
        {copy.all} <Badge appearance="tint">0</Badge>
      </Button>
      <Button
        aria-pressed={resultFilter === "generic"}
        className="result-filter-button"
        onClick={() => onSelectFilter("generic")}
        appearance={resultFilter === "generic" ? "primary" : "subtle"}
        size="small"
      >
        {copy.generic}
      </Button>
      <Button
        aria-pressed={resultFilter === "faction"}
        className="result-filter-button"
        onClick={() => onSelectFilter("faction")}
        appearance={resultFilter === "faction" ? "primary" : "subtle"}
        size="small"
      >
        {copy.faction}
      </Button>
      <Button
        aria-pressed={resultFilter === "protective"}
        className="result-filter-button"
        onClick={() => onSelectFilter("protective")}
        appearance={resultFilter === "protective" ? "primary" : "subtle"}
        size="small"
      >
        {copy.protective}
      </Button>
    </div>

    <div className="results-table-wrap">
      <Table aria-label={copy.encountersTable} className="results-table">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>{copy.type}</TableHeaderCell>
            <TableHeaderCell>{copy.monitorIds}</TableHeaderCell>
            <TableHeaderCell>{copy.timestamp}</TableHeaderCell>
            <TableHeaderCell>{copy.distanceMeters}</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4}>
              <div className="table-empty-state">
                <Text weight="semibold">{copy.noResults}</Text>
                <Text size={200}>{copy.noResultsDescription}</Text>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <div className="results-footer">
      <Text size={100}>{copy.showingEncounters(0)}</Text>
      <div className="pagination-placeholder" aria-label={copy.pagination}>
        <Badge appearance="tint">{copy.page(1)}</Badge>
      </div>
    </div>
  </div>
);

export default ResultsPanel;
