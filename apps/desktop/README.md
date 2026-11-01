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

The desktop frontend uses Fluent UI React v9 (`@fluentui/react-components`).
Its initial screen is a small interactive button demo using `FluentProvider`
and the primary `Button` component.

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
