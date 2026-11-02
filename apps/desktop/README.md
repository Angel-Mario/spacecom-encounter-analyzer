# Desktop app

[Leia este README em português](README.pt-BR.md)

The desktop frontend is built with React, TypeScript, Vite+, and Tauri.

From the repository root, start the frontend or desktop shell with:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop dev
pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev
```

Use `tauri dev` for the integrated workflow. The plain `dev` command runs only the frontend preview, so native folder selection and CLI execution are not available there.

When the frontend runs in a regular browser, it loads clearly labeled, fictional encounters so the results, map, details, filters, pagination, and export UI can be developed without native APIs. The Tauri app never loads this mock data; it starts empty and displays only results returned by the CLI.

In the browser, start the demo analysis to see CLI-style output appear as each
sample dataset finishes. The summaries match the CLI format but use synthetic
metrics and do not execute the CLI.

The first desktop workflow uses the CLI's parallel processing path for every `.txt` file in the input folder and writes JSON files to the output folder. It only falls back to disk-backed sorting if a dataset has unordered timestamps. The folders default to `datasets/inputs` and `datasets/outputs`; either can be changed with the native folder picker. The CLI tab shows startup status and progress as each dataset begins and completes, followed by any execution errors. The workspace shows the parsed encounters in searchable, filterable, paginated results; selecting a row opens its details, and the map plots the encounter coordinates locally with encounter-type colors, a legend, selection summary, and zoom controls. Export downloads the complete result set as JSON. The Tauri window uses custom minimize, maximize/restore, and close controls; drag the header to move it.

The desktop scripts build the engine and CLI before starting the UI or building the frontend. Local development uses the installed Node.js runtime. Production installers include the CLI, the Node.js runtime used to build them, and (when provided by the build environment) its license, so end users do not need Node.js or the source checkout. Their default input and output folders are created under the operating system's per-user application data directory.

Build the desktop frontend with:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop build
```

Run the desktop UI tests with:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop test
```

The desktop frontend uses Fluent UI React v9 (`@fluentui/react-components`) and Fluent System Icons (`@fluentui/react-icons`). Its dashboard is split into independent components under `src/components/`, with shared layout styles under `src/styles/`.

The interface uses the official Spacecom logo from [spacecom.com.br](https://www.spacecom.com.br/imgs/logo-spc.svg) and a light brand theme.

The interface is available in Spanish, English, and Brazilian Portuguese. The language selector is in the app header; the app remembers the selection and uses the operating system language on first launch when it is English or Portuguese, falling back to Spanish otherwise.

## Releases

Push a `vX.Y.Z` tag after setting the same version in this package's `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. The **Desktop release** GitHub Actions workflow builds Windows x64, macOS Intel, macOS Apple silicon, and Linux x64 installers, then creates a draft GitHub Release with the artifacts. Publish the draft after reviewing it. Windows installers are unsigned and may trigger SmartScreen warnings.

The workflow signs and notarizes macOS DMGs when these GitHub repository secrets are configured: `APPLE_CERTIFICATE` (base64-encoded Developer ID Application `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), and `APPLE_TEAM_ID`. Without them, the DMGs are unsigned and unnotarized; Gatekeeper may block the app, so do not publish them as production-ready downloads.

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
