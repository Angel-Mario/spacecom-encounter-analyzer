import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
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
