import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/@spacecom-encounter-analyzer\/.*/u],
  },
  entry: ["./src/index.ts", "./src/parallel-dataset-worker.ts"],
  format: "esm",
  outDir: "./dist",
});
