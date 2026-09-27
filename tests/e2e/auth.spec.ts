import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Test di accettazione WP-008 (ADR-0013): registrazione e accesso con il codice letto da Mailpit.
// Servono il DB migrato e Mailpit (docker-compose.dev.yml; in CI sono servizi del job).

const MAILPIT = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

async function mailpitReachable(request: APIRequestContext): Promise<boolean> {
  try {
    return (await request.get(`${MAILPIT}/api/v1/info`, { timeout: 2000 })).ok();
  } catch {
    return false;
  }
}

/** Aspetta l'email più recente per `to` diversa da `previousId` e ne estrae il codice dall'oggetto. */
async function waitForCode(
  request: APIRequestContext,
  to: string,
  previousId?: string,
): Promise<{ id: string; code: string }> {
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

async function requestCode(page: Page, email: string) {
  await page.goto("/accedi");
  await page.getByLabel("La tua email").fill(email);
  await page.getByRole("button", { name: "Ricevi il codice" }).click();
  await expect(page.getByRole("heading", { name: "Controlla la tua email" })).toBeVisible();
}

test.describe("accesso con codice via email", () => {
  test.beforeEach(async ({ request }) => {
    const reachable = await mailpitReachable(request);
    // In CI Mailpit deve esserci: se manca, il test fallisce invece di essere saltato.
    test.skip(
      !reachable && !process.env.CI,
      "Mailpit non raggiungibile (avvia docker-compose.dev.yml)",
    );
  });

  test("registrazione, uscita e nuovo accesso", async ({ page, request, context }) => {
    const email = `e2e+${randomUUID().slice(0, 8)}@esempio.it`;

    await requestCode(page, email);
    const first = await waitForCode(request, email);

    // Codice sbagliato: messaggio chiaro con i tentativi rimasti.
    const wrong = String((Number(first.code) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel("Codice di 6 cifre").fill(wrong);
    await page.getByRole("button", { name: "Entra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Codice sbagliato" })).toContainText(
      "Tentativi rimasti: 4",
    );

    await page.getByLabel("Codice di 6 cifre").fill(first.code);
    await page.getByRole("button", { name: "Entra" }).click();

    // Prima volta: si crea l'account.
    await expect(page.getByRole("heading", { name: "Crea il tuo account" })).toBeVisible();
    await page.getByLabel("Cercare lavoro").check();
    await page.getByLabel("Ho almeno 18 anni").check();
    await page
      .getByLabel("Ho letto l'informativa sulla privacy e accetto le condizioni d'uso")
      .check();
    await page.getByRole("button", { name: "Crea l'account" }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("Sei entrato come: persona in cerca di lavoro")).toBeVisible();

    // L'email non compare mai nell'URL (R-PRIV-05) e il cookie di sessione non è leggibile da JavaScript.
    expect(page.url()).not.toContain("esempio.it");
    const session = (await context.cookies()).find((c) => c.name.endsWith("sessione"));
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("sessione");

    // Uscita: la pagina dell'account torna a chiedere l'accesso.
    await page.getByRole("button", { name: "Esci" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/accedi$/);

    // Secondo accesso: niente registrazione, si entra direttamente.
    await requestCode(page, email);
    const second = await waitForCode(request, email, first.id);
    await page.getByLabel("Codice di 6 cifre").fill(second.code);
    await page.getByRole("button", { name: "Entra" }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("un'email scritta male viene segnalata senza inviare nulla", async ({ page }) => {
    await page.goto("/accedi");
    await page.getByLabel("La tua email").fill("mario.rossi@");
    // La validazione del browser blocca l'invio: il campo resta non valido.
    await page.getByRole("button", { name: "Ricevi il codice" }).click();
    await expect(page.getByLabel("La tua email")).toHaveJSProperty("validity.valid", false);
  });
});
