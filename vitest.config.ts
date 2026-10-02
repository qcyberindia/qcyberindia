import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Accounting logic is pure TypeScript with no React/browser dependencies,
// so tests run in plain Node. Tests live under tests/. The "@" alias mirrors
// tsconfig.json's paths so lib/fund/* (which uses "@/lib/...") can be tested.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
