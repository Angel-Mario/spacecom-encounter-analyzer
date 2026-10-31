import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "./src/index.ts",
    "parallel-dataset-worker":
      "./src/infrastructure/files/parallel-dataset-worker.ts",
  },
  format: "esm",
  outDir: "./dist",
});
