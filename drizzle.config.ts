import { defineConfig } from "drizzle-kit";

// Migrazioni SQL versionate e revisionate (ADR-0003). Generazione: `pnpm db:generate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://hr:hr_dev_only@localhost:5432/hr" },
  strict: true,
  verbose: true,
});
