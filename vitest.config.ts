import { defineConfig } from "vitest/config";

// Accounting logic is pure TypeScript with no React/browser dependencies,
// so tests run in plain Node. Tests live under tests/ and import accounting
// modules by relative path.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
