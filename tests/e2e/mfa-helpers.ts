import { expect, type Page } from "@playwright/test";
import { base32Decode, totpStep } from "../../src/modules/identity/domain";
import { hotp } from "../../src/modules/identity/server/totp";

/** Codice TOTP per il segreto mostrato nella pagina; `offset` in passi di 30 secondi (+1 = il prossimo). */
export function totpFor(secret: string, offset = 0): string {
  return hotp(base32Decode(secret)!, totpStep(new Date()) + offset);
}

/**
 * Attivazione della 2FA come la fa una persona: legge la chiave sotto il QR, scrive il codice dell'app,
 * vede i codici di recupero e continua. Ritorna il segreto e i codici.
 */
export async function enrollSecondFactor(
  page: Page,
): Promise<{ secret: string; recoveryCodes: string[] }> {
  await expect(page.getByRole("heading", { name: "Proteggi il tuo account" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Codice QR/ })).toBeVisible();
  const secret = (await page.getByTestId("mfa-secret").innerText()).replace(/\s/g, "");
  await page.getByLabel("Codice di 6 cifre dell'app").fill(totpFor(secret));
  await page.getByRole("button", { name: "Attiva ed entra" }).click();

  await expect(page.getByRole("heading", { name: "Salva i codici di recupero" })).toBeVisible();
  const recoveryCodes = await page
    .getByTestId("recovery-codes")
    .getByRole("listitem")
    .allInnerTexts();
  expect(recoveryCodes).toHaveLength(10);
  await page.getByRole("button", { name: "Li ho salvati, continua" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return { secret, recoveryCodes };
}
