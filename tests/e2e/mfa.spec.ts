import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { enrollSecondFactor, totpFor } from "./mfa-helpers";

// Test di accettazione WP-011b: un'azienda attiva la 2FA, poi entra con il codice dell'app o di recupero.

const MAILPIT = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

async function waitForCode(request: APIRequestContext, to: string, previousId?: string) {
  let found: { id: string; code: string } | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const body = (await res.json()) as { messages: { ID: string; Subject: string }[] };
        const latest = body.messages[0];
        const code = latest && /\b(\d{6})\b/.exec(latest.Subject)?.[1];
        if (latest && code && latest.ID !== previousId) found = { id: latest.ID, code };
        return found !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

async function emailStep(
  page: Page,
  request: APIRequestContext,
  email: string,
  previousId?: string,
) {
  await page.goto("/accedi");
  await page.getByLabel("La tua email").fill(email);
  await page.getByRole("button", { name: "Ricevi il codice" }).click();
  const mail = await waitForCode(request, email, previousId);
  await page.getByLabel("Codice di 6 cifre").fill(mail.code);
  await page.getByRole("button", { name: "Entra", exact: true }).click();
  return mail.id;
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("un'azienda attiva la 2FA e poi entra con il codice dell'app o con un codice di recupero", async ({
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

  // Tre codici email in un test: un IP di prova tutto suo, per non consumare il limite per IP degli altri test.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${randomInt(1, 255)}` });
  const email = `azienda2fa+${randomUUID().slice(0, 8)}@esempio.it`;
  let lastMail = await emailStep(page, request, email);
  await page.getByLabel("Cercare personale per un'azienda").check();
  await page.getByLabel("Ho almeno 18 anni").check();
  await page
    .getByLabel("Ho letto l'informativa sulla privacy e accetto le condizioni d'uso")
    .check();
  await page.getByRole("button", { name: "Crea l'account" }).click();

  // Prima del secondo fattore non c'è nessuna sessione: l'account non si apre.
  await expect(page.getByRole("heading", { name: "Proteggi il tuo account" })).toBeVisible();
  const { secret, recoveryCodes } = await enrollSecondFactor(page);
  // Il segreto non finisce mai nell'URL (R-PRIV-05).
  expect(page.url()).not.toContain(secret);
  await signOut(page);

  // Secondo accesso: codice email, poi il codice dell'app (niente QR).
  lastMail = await emailStep(page, request, email, lastMail);
  await expect(
    page.getByRole("heading", { name: "Codice dell'app di autenticazione" }),
  ).toBeVisible();
  await expect(page.getByTestId("mfa-secret")).toHaveCount(0);
  // Il codice del prossimo periodo vale già (±30 secondi) e non è quello usato per l'attivazione.
  const next = totpFor(secret, 1);
  const wrong = String((Number(next) + 1) % 1_000_000).padStart(6, "0");
  await page.getByLabel("Codice di 6 cifre dell'app").fill(wrong);
  await page.getByRole("button", { name: "Entra", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Codice sbagliato" })).toContainText(
    "Tentativi rimasti: 4",
  );
  await page.getByLabel("Codice di 6 cifre dell'app").fill(next);
  await page.getByRole("button", { name: "Entra", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await signOut(page);

  // Telefono perso: si entra con un codice di recupero.
  await emailStep(page, request, email, lastMail);
  await page.getByText("Non hai il telefono? Usa un codice di recupero").click();
  await page.getByLabel("Codice di recupero").fill(recoveryCodes[0]!.toUpperCase());
  await page.getByRole("button", { name: "Entra con il codice di recupero" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
