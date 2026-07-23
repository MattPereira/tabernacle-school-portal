import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the tsconfig "@/*" path so tests import modules the same way the
  // app does; vitest doesn't read tsconfig paths on its own.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // tests/ only — the src/ barrier is "does the running app import it?", and
    // tests don't (docs/conventions.md, Testing).
    include: ["tests/**/*.test.ts"],
  },
});
