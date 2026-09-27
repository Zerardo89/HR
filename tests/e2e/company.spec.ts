import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Test di accettazione WP-011: un'azienda si registra e vede lo stato della verifica.
// VIES negli e2e non è raggiungibile (playwright.config.ts): l'azienda resta "in verifica".

const MAILPIT = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

/** P.IVA sintetica con cifra di controllo corretta (diversa a ogni esecuzione). */
function syntheticVat(): string {
  const base = `9${String(randomInt(0, 1e9)).padStart(9, "0")}`;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(base[i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return base + String((10 - (sum % 10)) % 10);
}

async function codeFor(request: APIRequestContext, to: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const { messages } = (await res.json()) as { messages: { Subject: string }[] };
        code = messages[0] && /\b(\d{6})\b/.exec(messages[0].Subject)?.[1];
        return code !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return code!;
}

async function signUpAsCompany(page: Page, request: APIRequestContext) {
  const email = `azienda+${randomUUID().slice(0, 8)}@esempio.it`;
  await page.goto("/accedi?tipo=azienda");
  await page.getByLabel("La tua email").fill(email);
  await page.getByRole("button", { name: "Ricevi il codice" }).click();
  await page.getByLabel("Codice di 6 cifre").fill(await codeFor(request, email));
  await page.getByRole("button", { name: "Entra" }).click();
  // Il ruolo "azienda" è già scelto grazie a ?tipo=azienda.
  await expect(page.getByLabel("Cercare personale per un'azienda")).toBeChecked();
  await page.getByLabel("Ho almeno 18 anni").check();
  await page
    .getByLabel("Ho letto l'informativa sulla privacy e accetto le condizioni d'uso")
    .check();
  await page.getByRole("button", { name: "Crea l'account" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("un'azienda si registra con la P.IVA e vede la verifica in corso", async ({
  page,
  request,
}) => {
  const reachable = await request
    .get(`${MAILPIT}/api/v1/info`, { timeout: 2000 })
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(
    !reachable && !process.env.CI,
    "Mailpit non raggiungibile (avvia docker-compose.dev.yml)",
  );

  await signUpAsCompany(page, request);
  await page.getByRole("link", { name: "Vai all'area azienda" }).click();
  await expect(page).toHaveURL(/\/azienda$/);

  // P.IVA sbagliata: errore chiaro, nessuna chiamata a VIES.
  await page.getByLabel("Partita IVA").fill("12345678901");
  await page.getByLabel("Nome che vedranno i candidati").fill("Trattoria Finta");
  await page.getByRole("button", { name: "Registra l'azienda" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Partita IVA" })).toContainText(
    "non è corretta",
  );

  await page.getByLabel("Partita IVA").fill(`IT ${syntheticVat()}`);
  await page.getByRole("button", { name: "Registra l'azienda" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Trattoria Finta" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "In verifica" })).toBeVisible();
});

test("l'area azienda è riservata: senza accesso si torna alla pagina di accesso", async ({
  page,
}) => {
  await page.goto("/azienda");
  await expect(page).toHaveURL(/\/accedi$/);
});
