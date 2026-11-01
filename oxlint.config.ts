import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: [
    ".agents/**",
    ".agent/**",
    ".cursor/**",
    ".kiro/**",
    ".kilocode/**",
    ".trae/**",
    ".claude/**",
    "node_modules/**",
    "dist/**",
  ],
});
