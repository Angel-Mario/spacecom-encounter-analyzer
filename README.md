# Spacecom Encounter Analyzer

Spacecom Encounter Analyzer is a standalone Node.js command-line application for
analyzing geolocation datasets and, in the future, detecting encounters between
monitored individuals. The repository is a pnpm monorepo; the reusable engine
package is intended to be shared by the CLI and a future desktop application.

## Current architecture

```text
apps/
  cli/       Node.js CLI
packages/
  config/    Shared TypeScript configuration
  engine/    Reusable engine package
```

The CLI currently prints its name and version. The engine is only package
infrastructure with an empty entry point. Dataset processing, domain models,
parsers, and encounter detection are planned functionality and are not
implemented. A future Electron + React desktop app is also planned, but does
not exist yet.

## Technologies

- Node.js with TypeScript and ESM
- pnpm workspaces and workspace catalogs
- Vite+ for task orchestration, linting, formatting, and checks
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

Vite+ is the unified interface for these project checks. Testing is not
configured yet and will be addressed separately.
