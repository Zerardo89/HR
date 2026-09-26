import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "it-IT",
    // Facoltativo: Chromium già installato altrove (es. ambienti senza download dei browser).
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    // Telefono Android economico: il nostro utente tipo (docs/01-PRODOTTO.md §3).
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Configurazione di test (nessun segreto reale). Il DB può mancare: /api/health risponde "down".
        env: {
          APP_URL: baseURL,
          DATABASE_URL: process.env.DATABASE_URL ?? "postgres://hr:hr_dev_only@localhost:5432/hr",
          KEK_FILE: "./tests/fixtures/test-kek.b64",
          BLIND_INDEX_KEY_FILE: "./tests/fixtures/test-blind-index.b64",
          SMTP_HOST: "localhost",
          SMTP_PORT: "1025",
          MAIL_FROM: "HR test <noreply@localhost>",
        },
      },
});
