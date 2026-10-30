# Spacecom Encounter Analyzer

Spacecom Encounter Analyzer is a Node.js/TypeScript command-line application for
analyzing geolocation datasets and detecting encounters between monitored
individuals. The repository is a pnpm monorepo; its reusable engine is intended
to be shared by the CLI and a future desktop application.

## Current architecture

```text
apps/
  cli/       Node.js CLI
packages/
  config/    Shared TypeScript configuration
  engine/    Reusable engine package, domain types, and dataset infrastructure
```

The engine includes Zod schemas for validating dataset rows, a parser for the
semicolon-delimited input files, and file readers/writers. Encounter detection
and the complete CLI workflow are still being implemented. A future Electron +
React desktop app is also planned, but does not exist yet.

## Technologies

- Node.js with TypeScript and ESM
- pnpm workspaces and workspace catalogs
- Zod 4 for dataset validation
- Vite+ for task orchestration, linting, formatting, and checks
- Vitest through Vite+ for unit and dataset integration tests
- tsdown/Rolldown for package builds
- Oxlint and Oxfmt through Ultracite
- Husky for Git hooks

## Prerequisites

- Node.js 24.11 or newer
- pnpm 12.14.0

## Installation

```bash
pnpm install
```

## Development

Run all workspace development tasks:

```bash
pnpm dev
```

Run the engine tests, including parsing every `.txt` file currently in
`datasets/inputs`:

```bash
pnpm test
```

Before each commit, Husky runs the staged-file checks and this test suite. A
failed check blocks the commit.

Build the engine and develop only the CLI:

```bash
pnpm dev:cli
```

## Builds

Build all workspace packages:

```bash
pnpm build
```

Build the engine and CLI:

```bash
pnpm build:cli
```

Run the compiled CLI after building:

```bash
pnpm --filter @spacecom-encounter-analyzer/cli start
```

## Type checking and code quality

```bash
pnpm check-types
pnpm lint
pnpm format
pnpm check
pnpm staged
```

Vite+ is the unified interface for these project checks and tests.
