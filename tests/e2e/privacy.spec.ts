import { expect, test } from "@playwright/test";
import { mailpitReachable, newTestEmail, seedLodi, signUp } from "./helpers";

// Test di accettazione WP-023 (R-PRIV-04): esporta i miei dati e cancella l'account, da sola/o, dal sito.

test("centro privacy: scarico i miei dati, cancello l'account, posso registrarmi di nuovo", async ({
  page,
  request,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  test.setTimeout(90_000);
  const email = newTestEmail("privacy");
  const seen: string[] = [];
  await seedLodi();
  await signUp(page, request, email, "lavoratore", seen);
  await page.goto("/profilo");
  await page.getByLabel("Nome", { exact: true }).fill("Luciafinta");
  await page.getByLabel("Cognome").fill("Dirittifinta");
  await page.getByRole("combobox", { name: "Mansione principale" }).fill("barman");
  await page.getByRole("option", { name: /^Barista/ }).click();
  await page.getByLabel("Il tuo comune").fill("Lodi");
  await page.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(page.getByRole("status")).toContainText("Profilo salvato.");

  await page.goto("/account");
  await page.getByRole("link", { name: "Privacy e dati" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy e dati" })).toBeVisible();
  await expect(page.getByText("Accettazione delle condizioni d'uso")).toBeVisible();

  // Esporta: file JSON con i miei dati in chiaro.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica i miei dati" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("i-miei-dati.json");
  const data = JSON.parse(
    Buffer.from(
      await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c)),
    ).toString("utf8"),
  ) as { account: { email: string }; profilo: { datiIdentificativi: { firstName: string } } };
  expect(data.account.email).toBe(email);
  expect(data.profilo.datiIdentificativi.firstName).toBe("Luciafinta");

  // Senza accesso l'esportazione non risponde.
  expect((await request.get("/api/privacy/export")).status()).toBe(401);

  // Cancella: la parola sbagliata non basta.
  await page.getByLabel("Per confermare scrivi CANCELLA").fill("forse");
  await page.getByRole("button", { name: "Cancella il mio account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "scrivi la parola richiesta" }),
  ).toBeVisible();
  await page.getByLabel("Per confermare scrivi CANCELLA").fill("cancella");
  await page.getByRole("button", { name: "Cancella il mio account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account cancellato" })).toBeVisible();

  // La sessione non vale più; la stessa email crea un account nuovo, senza il vecchio profilo.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/accedi/);
  await signUp(page, request, email, "lavoratore", seen);
  await page.goto("/profilo");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("");
});
