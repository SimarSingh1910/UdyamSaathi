import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Each test worker gets its own throwaway store, seeded from the CSVs.
    setupFiles: ["tests/setup.ts"],
  },
});
