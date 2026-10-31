import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/cli/dist/**",
      "packages/engine/dist/**",
      "datasets/**",
    ],
    semi: true,
    singleQuote: false,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/cli/dist/**",
      "packages/engine/dist/**",
      "datasets/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
  test: {
    fileParallelism: false,
    include: ["apps/cli/src/**/*.test.ts", "packages/engine/src/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
