import path from "node:path";
import { defineConfig } from "vitest/config";

// Test di integrazione con un Postgres/PostGIS reale già migrato (`pnpm db:migrate`).
// Uso: DATABASE_URL=postgres://… pnpm test:integration
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
  },
});
