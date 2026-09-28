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
          // Con E2E_APP_DATABASE_URL il sito gira col ruolo ristretto `hr_app` (WP-027); i test preparano i dati
          // con DATABASE_URL (proprietario).
          DATABASE_URL:
            process.env.E2E_APP_DATABASE_URL ??
            process.env.DATABASE_URL ??
            "postgres://hr:hr_dev_only@localhost:5432/hr",
          KEK_FILE: "./tests/fixtures/test-kek.b64",
          BLIND_INDEX_KEY_FILE: "./tests/fixtures/test-blind-index.b64",
          SMTP_HOST: "localhost",
          SMTP_PORT: "1025",
          MAIL_FROM: "HR test <noreply@localhost>",
          // Negli e2e VIES non si chiama mai: porta chiusa → azienda "in verifica" (percorso di riserva).
          VIES_API_URL: "http://127.0.0.1:9",
          // Tutti i test arrivano da 127.0.0.1: il limite per IP (testato a parte) li bloccherebbe a vicenda.
          // Un'intestazione che nessuno invia = nessun IP = limite per IP spento; restano i limiti per email.
          CLIENT_IP_HEADER: "x-e2e-nessun-ip",
        },
      },
});
