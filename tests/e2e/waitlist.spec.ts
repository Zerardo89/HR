import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Test di accettazione WP-009: lista d'attesa con doppia conferma (link letto da Mailpit) e dati dell'ente.

const MAILPIT = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

test("iscrizione alla lista d'attesa e conferma dal link dell'email", async ({ page, request }) => {
  const reachable = await request
    .get(`${MAILPIT}/api/v1/info`, { timeout: 2000 })
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(
    !reachable && !process.env.CI,
    "Mailpit non raggiungibile (avvia docker-compose.dev.yml)",
  );

  const email = `attesa+${randomUUID().slice(0, 8)}@esempio.it`;
  await page.goto("/");
  await page.getByRole("link", { name: "Avvisami quando apre" }).click();
  const form = page.locator("#lista-attesa");
  await form.getByLabel("La tua email").fill(email);
  await form.getByLabel("Una persona che cerca lavoro").check();
  await form.getByLabel(/Voglio ricevere un'email al lancio/).check();
  await form.getByRole("button", { name: "Avvisami" }).click();
  await expect(form.getByRole("status")).toContainText("Controlla la tua email");

  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${email}"` },
        });
        const { messages } = (await res.json()) as { messages: { ID: string }[] };
        if (!messages[0]) return false;
        const message = await (
          await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
        ).json();
        link = /https?:\/\/\S+\/lista-attesa\/conferma\?t=[A-Za-z0-9_-]{43}/.exec(
          message.Text,
        )?.[0];
        return link !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  // Aprire il link NON conferma (R-MAIL-02): serve il pulsante.
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  await expect(page.getByRole("heading", { name: "Conferma l'iscrizione" })).toBeVisible();
  await page.getByRole("button", { name: "Conferma" }).click();
  await expect(page.getByRole("status")).toContainText("Iscrizione confermata");
});

test("la pagina 'Chi siamo' e il piè di pagina riportano i dati dell'ente (R-LAV-04, R-CONS-04)", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Legale rappresentante")).toBeVisible();
  await expect(footer.getByText("Partita IVA")).toBeVisible();
  await footer.getByRole("link", { name: "Chi siamo" }).click();
  await expect(page).toHaveURL(/\/chi-siamo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Chi siamo" })).toBeVisible();
  await expect(page.getByRole("main").getByText("PEC")).toBeVisible();
});

test("le pagine legali esistono e sono marcate come bozza", async ({ page }) => {
  // `/segnalazioni` non è più un segnaposto: dal WP-024a è la pagina per segnalare (tests/e2e/reports.spec.ts).
  for (const path of ["/privacy", "/cookie", "/condizioni", "/contatti"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("note")).toContainText("BOZZA");
  }
});
