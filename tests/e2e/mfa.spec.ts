import { expect, test } from "@playwright/test";
import {
  authenticatorCode,
  emailCode,
  enableTwoFactor,
  mailpitReachable,
  newTestEmail,
  signUp,
} from "./helpers";

// Test di accettazione WP-011b: per le aziende la verifica in due passaggi è obbligatoria (ADR-0013 §8).

test("azienda: 2FA obbligatoria alla registrazione e richiesta a ogni nuovo accesso", async ({
  page,
  request,
}) => {
  test.skip(!(await mailpitReachable(request)) && !process.env.CI, "Mailpit non raggiungibile");
  const email = newTestEmail("dueFA");
  const seen: string[] = [];

  await signUp(page, request, email, "azienda");
  // Senza 2FA l'area azienda non si apre: si finisce sulla pagina di attivazione.
  await page.goto("/azienda");
  const key = await enableTwoFactor(page);
  const codes = page
    .getByRole("list", { name: "Salva questi codici di recupero" })
    .getByRole("listitem");
  await expect(codes).toHaveCount(10);
  await page.getByRole("link", { name: "Ho salvato i codici, continua" }).click();
  await expect(page).toHaveURL(/\/azienda$/);

  // Uscita e nuovo accesso: dopo il codice email serve il codice dell'app.
  await page.goto("/account");
  await page.getByRole("button", { name: "Esci" }).click();
  await page.goto("/accedi");
  await page.getByLabel("La tua email").fill(email);
  await page.getByRole("button", { name: "Ricevi il codice" }).click();
  await emailCode(request, email, seen); // la prima email (registrazione)
  await page.getByLabel("Codice di 6 cifre").fill(await emailCode(request, email, seen));
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page).toHaveURL(/\/accedi\/verifica$/);

  // Finché non si supera il secondo passaggio, le pagine riservate rimandano qui.
  await page.goto("/azienda");
  await expect(page).toHaveURL(/\/accedi\/verifica$/);

  await page.getByLabel("Codice dell'app o codice di recupero").fill("000000");
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Codice non valido" })).toContainText(
    "Tentativi rimasti: 4",
  );

  // Il codice del periodo successivo (quello usato all'attivazione non vale una seconda volta).
  await page.getByLabel("Codice dell'app o codice di recupero").fill(authenticatorCode(key, 30));
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/azienda");
  await expect(page).toHaveURL(/\/azienda$/);
});

test("lavoratore: la 2FA è facoltativa, si entra subito", async ({ page, request }) => {
  test.skip(!(await mailpitReachable(request)) && !process.env.CI, "Mailpit non raggiungibile");
  await signUp(page, request, newTestEmail("lavoratore"), "lavoratore");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("link", { name: "Sicurezza dell'account" }).click();
  await expect(page.getByText("Facoltativa: aggiunge un secondo controllo")).toBeVisible();
});
