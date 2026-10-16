import { expect, test } from "@playwright/test";

// Test di accettazione WP-024c (art. 13 GDPR): informativa completa, versionata come le condizioni d'uso.

test("informativa sulla privacy: versione in vigore completa e versioni precedenti", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { level: 1, name: "Informativa sulla privacy" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText("BOZZA");
  await expect(page.getByText(/^Versione in vigore dal \d{1,2} \w+ \d{4}\.$/)).toBeVisible();
  for (const [id, title] of [
    ["titolare", "1. Chi è il titolare del trattamento"],
    ["conservazione", "7. Per quanto tempo conserviamo i dati"],
    ["diritti", "9. I tuoi diritti"],
  ] as const) {
    await expect(page.locator(`#${id}`)).toHaveText(title);
  }
  // La sola frase approvata sulla cifratura (docs/04 §1).
  await expect(page.getByText(/^I tuoi dati personali sono cifrati nel database\./)).toBeVisible();

  await page.getByRole("link", { name: /^27 settembre 2026$/ }).click();
  await expect(page).toHaveURL(/\/privacy\?versione=bozza-2026-09-27$/);
  await expect(
    page.getByText("Versione del 27 settembre 2026: non è più in vigore."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leggi la versione in vigore" }).click();
  await expect(page.locator("#diritti")).toBeVisible();
});
