# Validation

This document describes the test suite, validation methodology, and performance benchmarks for the Spacecom Encounter Analyzer.

## Running the tests

```bash
pnpm test
```

This runs every unit and integration test across all workspace packages through Vite+/Vitest. Tests are run sequentially (not in parallel across files) because the dataset integration test streams large files from disk and running it in parallel with other tests could distort memory measurements and cause false timeouts.

Before each commit, Husky executes the same test suite alongside staged-file lint and format checks. A failed test blocks the commit.

## Test suite overview

All test files live next to the source files they cover inside `packages/engine/src`. There are no test files in `apps/cli` or `packages/config` — the CLI is exercised indirectly through the integration test and manual benchmark runs.

| Test file                                                 | Module under test                                                   | Tests |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| `core/algorithms/haversine.test.ts`                       | `calculateDistanceMeters`                                           | 4     |
| `core/classifiers/encounter-classifier.test.ts`           | `classifyEncounter`                                                 | 6     |
| `core/grouping/timestamp-grouper.test.ts`                 | `groupSortedByTimestamp`, `groupUnsortedByTimestamp`                | 5     |
| `core/detectors/encounter-detector.test.ts`               | `detectEncounters`                                                  | 7     |
| `infrastructure/parsers/dataset-parser.test.ts`           | `parseDataset`, `readDatasetGroups`                                 | 4     |
| `infrastructure/files/external-timestamp-sorter.test.ts`  | `groupByExternalTimestampSort`, `readDatasetGroupsWithExternalSort` | 7     |
| `infrastructure/files/parallel-dataset-processor.test.ts` | `analyzeDatasetParallel`                                            | 5     |

**Total: 38 tests across 7 suites.**

## Unit tests

### Haversine distance (`haversine.test.ts`)

Verifies the `calculateDistanceMeters` function that implements the Haversine formula with the challenge-specified Earth radius of 6,371,000 m.

- **Identical coordinates** return exactly `0`.
- **Challenge example pair** (`-10.07996, -37.08384` and `-10.07987, -37.08389`) produces `≈ 11.4068 m`, matching the expected value to 10 decimal places.
- **Symmetry**: distance from A to B equals distance from B to A.
- **Antipodal points** (`(0, 0)` and `(0, 180)`) produce `π × R`, verifying the formula handles the numerically degenerate case without overflow or NaN.

### Encounter classifier (`encounter-classifier.test.ts`)

Verifies `classifyEncounter`, which assigns `tipo` to a confirmed candidate pair.

- **Generic encounter**: two unrelated people (no faction, no protective measure) → `generico`.
- **Faction encounter**: two people sharing the same non-null `factionId` → `faccao`.
- **Null faction guard**: two people with `factionId: null` are **not** treated as faction members → `generico`.
- **Protective encounter**: one person has a protective measure listing the other's ID → `protetiva`, regardless of argument order.
- **No false positive**: a person with a protective measure whose restriction list does not include the other person's ID → `generico`.
- **Precedence**: when both protective and faction rules apply (same faction, restriction present), the result is `protetiva`, not `faccao`.

### Timestamp grouper (`timestamp-grouper.test.ts`)

Verifies the streaming grouper that partitions `MonitoredPerson` records by exact timestamp string.

- **Grouping by exact match**: records with the same timestamp string are collected together; a different string starts a new group.
- **Order preserved within group**: records appear in insertion order inside each group.
- **Empty input**: produces no groups and no errors.
- **Out-of-order detection**: a record whose timestamp precedes the current group's timestamp throws `UnsortedTimestampsError` carrying `previousTimestamp`, `currentTimestamp`, and `recordNumber`.
- **In-memory fallback** (`groupUnsortedByTimestamp`): loads all records into a `Map` keyed by timestamp, tolerating any arrival order.

### Encounter detector (`encounter-detector.test.ts`)

Verifies `detectEncounters`, which takes an async iterable of `[timestamp, MonitoredPerson[]]` groups and yields `EncounterCandidate` objects for pairs within 20 m.

- **Basic detection**: the challenge's example pair at `≈ 11.4 m` is detected with the correct distance and timestamp.
- **Boundary condition**: a pair at exactly 20 m and a pair beyond 20 m are both **not** detected. The test constructs the 20 m pair analytically from the Haversine formula to avoid floating-point ambiguity.
- **Duplicate ID guard**: two records for the same monitored ID within a group are treated as a single person; only the pair with the other ID is considered.
- **Cross-timestamp isolation**: records from different timestamp groups are never compared against each other.
- **Timestamp integrity check**: a record inside a group whose own `timestamp` field differs from the group key throws immediately with a descriptive message.
- **Single-record group**: a group with fewer than two records produces no encounters.
- **Spatial index correctness** (exhaustive comparison): a randomised set of 104 points spread across global coordinates is run through the indexed detector and the naive O(n²) brute-force reference. Results must be identical, validating that the spatial hash index produces no false negatives.

### Dataset parser (`dataset-parser.test.ts`)

Verifies `parseDataset` (parses a complete in-memory string) and the streaming `readDatasetGroups` integration path.

- **Field conversion**: a row with all fields populated — including a quoted timestamp, a quoted `idsRestricaoMedida` list, and a boolean `medidaProtetiva` — is parsed into the correct `MonitoredPerson` domain object.
- **Invalid field rejection**: a row with a missing latitude or an impossible date (`2026-02-30`) throws an error that cites the dataset row number.
- **Unclosed quoted field**: an unterminated quoted field throws a descriptive parse error.
- **Dataset integration** (parameterised over every `.txt` file in `datasets/inputs`): for each file, the test streams through `readDatasetGroups`, verifies that timestamps are non-decreasing, confirms that every record in a group carries that group's timestamp, and asserts that record and timestamp counts match known values for datasets 1–5. This test has a 3-minute timeout because datasets 6 and 7 together total about 20 million records. Known expected counts:

  | Dataset      | Records   | Unique timestamps |
  | ------------ | --------- | ----------------- |
  | dataset1.txt | 5,000     | 500               |
  | dataset2.txt | 25,000    | 1,250             |
  | dataset3.txt | 100,000   | 2,500             |
  | dataset4.txt | 400,020   | 6,667             |
  | dataset5.txt | 1,000,000 | 12,500            |

### External timestamp sorter (`external-timestamp-sorter.test.ts`)

Verifies `groupByExternalTimestampSort`, the disk-backed external merge-sort path used when the streaming grouper detects an out-of-order dataset.

- **Basic sort and merge**: five records in scrambled timestamp order with a `chunkSize` of 2 are sorted into three groups in the correct order, including merging records from the same timestamp that appeared in different sort runs.
- **Multi-run merge**: 70 records in reverse timestamp order with `chunkSize: 1` (one record per run, 70 sort runs) merge correctly into 70 groups in ascending order.
- **File-based integration**: a two-record `.txt` file written with reversed timestamps is read by `readDatasetGroupsWithExternalSort` and yields groups in the correct order; the temporary directory contains only the original file afterwards, confirming cleanup.
- **Temporary file cleanup on success**: after a normal run, all intermediate sort-run files are removed from the temporary directory.
- **Temporary file cleanup on early consumer exit**: if the consumer breaks out of the iteration before exhausting the output, all temporary files are still removed.
- **Temporary file cleanup on input stream failure**: if the input async generator throws mid-stream, all temporary files are still removed.
- **Invalid chunk size**: `chunkSize: 0` throws immediately with a message referencing `chunkSize`.

### Parallel dataset processor (`parallel-dataset-processor.test.ts`)

Verifies `analyzeDatasetParallel`, which splits a file into line-aligned chunks and processes them across `worker_threads`, then merges encounters back into a single ordered result.

- **Chunk boundary correctness**: a four-group dataset (25 + 15 + 60 + 5 records) with a tiny `chunkBytes` of 256 forces many splits. The parallel result must equal the serial reference exactly — including encounter count (2,185), record count (105), timestamp count (4), and the full ordered encounter list.
- **Out-of-order error propagation**: a dataset with timestamps in reverse order produces an `UnsortedTimestampsError` with a message that identifies the exact serial record number where the order breaks, matching what the single-threaded path would report.
- **Small dataset serialisation**: a dataset with 3 records (below the two-chunk minimum) is processed in the main process; the result equals the serial reference.
- **Blank lines across chunk boundaries**: blank lines interspersed with records, split across chunk boundaries, are handled without losing records or miscounting encounters.
- **Environment variable configuration**: `SPACECOM_CHUNK_BYTES` and `SPACECOM_MAX_WORKERS` are read at runtime; setting them to `128` and `2` respectively and processing a two-group dataset produces a result identical to the serial reference.

## Integration and correctness validation

### Output parity across all datasets

Every benchmark run records encounter counts and per-type splits. These numbers have been consistent across all optimisation iterations:

| Dataset      | Records    | Timestamps | Encounters | Generic | Faction | Protective |
| ------------ | ---------- | ---------- | ---------- | ------- | ------- | ---------- |
| dataset1.txt | 5,000      | 500        | 4          | 2       | 1       | 1          |
| dataset2.txt | 25,000     | 1,250      | 6          | 3       | 2       | 1          |
| dataset3.txt | 100,000    | 2,500      | 10         | 5       | 3       | 2          |
| dataset4.txt | 400,020    | 6,667      | 15         | 7       | 5       | 3          |
| dataset5.txt | 1,000,000  | 12,500     | 21         | 10      | 7       | 4          |
| dataset6.txt | 8,000,000  | 80,000     | 27         | 12      | 9       | 6          |
| dataset7.txt | 12,000,000 | 100,000    | 35         | 15      | 12      | 8          |

For datasets 1–5, the full JSON output (pair identities, encounter order, and computed distances) was compared between the pre-optimisation baseline and each subsequent version and found to be identical. For datasets 6 and 7, a fresh serial reference was computed after each optimisation and compared against the parallel output using deep equality.

The inverted variant of dataset 5 (`dataset5-inverted.txt`, records in reversed timestamp order) was used to validate the external sort path and produced the same 21 encounters as the forward-sorted version.

## Performance benchmarks

Three optimisation stages were benchmarked sequentially. Each stage preserved the encounter counts above.

### Stage 1: spatial hash index

The brute-force O(n²) per-group comparison was replaced with a spatial hash index that narrows candidates to nearby cells before computing Haversine distances.

| Dataset      | Before (s) | After (s) | Change |
| ------------ | ---------- | --------- | ------ |
| dataset1.txt | 0.08       | 0.08      | 0.0%   |
| dataset2.txt | 0.26       | 0.29      | +11.5% |
| dataset3.txt | 1.08       | 0.99      | −8.3%  |
| dataset4.txt | 4.43       | 3.82      | −13.8% |
| dataset5.txt | 12.20      | 9.50      | −22.1% |
| dataset6.txt | 105.59     | 75.47     | −28.5% |
| dataset7.txt | 191.23     | 115.50    | −39.6% |

Datasets 6 and 7 together improved from 296.82 s to 190.97 s (≈1.55× throughput). Small datasets show noise-level differences; all encounter counts matched the baseline.

### Stage 2: CPU pipeline optimisations

Added value-cached timestamp validation, direct positional row validation bypassing per-row Zod objects, an ECEF chord gate that short-circuits the Haversine call for clearly distant pairs, a synchronous per-group detection generator, and a manual line reader replacing the `readline` interface.

| Dataset      | Spatial index (s) | CPU optimised (s) | vs baseline |
| ------------ | ----------------- | ----------------- | ----------- |
| dataset1.txt | 0.08              | 0.03              | −62.5%      |
| dataset2.txt | 0.29              | 0.09              | −65.4%      |
| dataset3.txt | 0.99              | 0.49              | −54.6%      |
| dataset4.txt | 3.82              | 1.82              | −58.9%      |
| dataset5.txt | 9.50              | 4.34              | −64.4%      |
| dataset6.txt | 75.47             | 34.84             | −67.0%      |
| dataset7.txt | 115.50            | 52.41             | −72.6%      |

Datasets 6 and 7 together improved from 190.97 s to 87.25 s (≈2.19× over the spatial-index stage, ≈3.40× over the original baseline). Two additional full-suite runs measured 90.79 s and 91.40 s for those two datasets combined, placing single-run variance around 3%. Heap usage stayed in the 7–38 MB range; RSS stayed under 200 MB per dataset.

### Stage 3: worker parallelisation

Large files are now split into line-aligned chunks and processed in parallel across `worker_threads` via `analyzeDatasetParallel`. Files below two 8 MiB chunks continue to use the in-process serial path.

Three consecutive full-suite runs were captured:

| Dataset      | Serial CPU-opt (s) | Run 1 (s) | Run 2 (s) | Run 3 (s) | Median (s) | Speedup |
| ------------ | ------------------ | --------- | --------- | --------- | ---------- | ------- |
| dataset1.txt | 0.03               | 0.03      | 0.11      | 0.05      | 0.05       | —       |
| dataset2.txt | 0.09               | 0.10      | 0.19      | 0.16      | 0.16       | —       |
| dataset3.txt | 0.49               | 0.55      | 0.77      | 0.76      | 0.76       | —       |
| dataset4.txt | 1.82               | 1.51      | 1.77      | 1.65      | 1.65       | —       |
| dataset5.txt | 4.34               | 2.38      | 2.34      | 2.38      | 2.38       | ≈1.8×   |
| dataset6.txt | 34.84              | 14.59     | 14.23     | 15.19     | 14.59      | ≈2.4×   |
| dataset7.txt | 52.41              | 22.53     | 21.60     | 22.92     | 22.53      | ≈2.3×   |

Datasets 6 and 7 together went from 87.25 s to ≈37.1 s (≈2.35× throughput) in this capture. The machine ran under a battery-saver CPU profile during the capture; standalone process runs of dataset 7 measured 10.12 s and 12.43 s in the same session (≈4.3–5.2× serial speedup) with identical output. The table above reflects the reproducible conservative result.

All encounter counts and per-type splits matched every previous baseline in all three runs. Full JSON output for datasets 6 and 7 was verified by deep equality against a freshly computed serial reference. Parity checks were re-run after the final refactor.

## Benchmark data

Raw benchmark output and comparison tables are stored in `datasets/test/`:

| File                                              | Contents                                     |
| ------------------------------------------------- | -------------------------------------------- |
| `benchmark-results-pre-optimizations.txt`         | Baseline run before any optimisation         |
| `benchmark-results-spatial-index.txt`             | Run after adding the spatial hash index      |
| `benchmark-comparison-spatial-index.txt`          | Side-by-side table for stage 1               |
| `benchmark-results-cpu-optimizations.txt`         | Run after CPU pipeline optimisations         |
| `benchmark-comparison-cpu-optimizations.txt`      | Side-by-side table for stage 2               |
| `cpu-profile-dataset7.txt`                        | CPU profile before optimisations (dataset 7) |
| `cpu-profile-dataset7-post-optimizations.txt`     | CPU profile after optimisations (dataset 7)  |
| `benchmark-results-worker-parallelization.txt`    | Three runs after worker parallelisation      |
| `benchmark-comparison-worker-parallelization.txt` | Side-by-side table for stage 3               |
