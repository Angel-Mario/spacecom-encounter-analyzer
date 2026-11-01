# Desktop app

The desktop frontend is built with React, TypeScript, Vite+, and Tauri.

From the repository root, start the frontend or desktop shell with:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop dev
pnpm --filter @spacecom-encounter-analyzer/desktop tauri dev
```

Build the frontend with:

```sh
pnpm --filter @spacecom-encounter-analyzer/desktop build
```

The desktop frontend uses Fluent UI React v9 (`@fluentui/react-components`)
and Fluent System Icons (`@fluentui/react-icons`). Its dashboard is split into
independent components under `src/components/`, with shared layout styles under
`src/styles/`. The fixed desktop layout includes dataset import, analysis
settings, result filters, map, and encounter details without page-level
scrolling.

The interface uses the official Spacecom logo from
[spacecom.com.br](https://www.spacecom.com.br/imgs/logo-spc.svg) and a light
brand theme.

The interface is available in Spanish, English, and Brazilian Portuguese. The
language selector is in the app header; the app remembers the selection and
uses the operating system language on first launch when it is English or
Portuguese, falling back to Spanish otherwise.

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
