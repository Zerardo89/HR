import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-013: un'azienda verificata scrive un'offerta, il controllo dal vivo segnala un
// problema di legalità, lei lo corregge e l'offerta va in moderazione (prime offerte, §3.2).
// VIES negli e2e non risponde: la verifica dell'azienda e la sede si preparano direttamente nel DB di prova.

function syntheticVat(): string {
  const base = `8${String(randomInt(0, 1e9)).padStart(9, "0")}`;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(base[i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return base + String((10 - (sum % 10)) % 10);
}

async function verifyCompanyWithSite(vat: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('015','Milano','MI','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('015146','Milano','015','03',45.4642,9.1900) on conflict do nothing`,
    );
    const { rows } = await pool.query<{ id: string }>(
      `update companies set status = 'verified', verified_at = now() where vat_number = $1 returning id`,
      [vat],
    );
    await pool.query(
      `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
       values ($1, '015146', 'Sede legale', true, now())`,
      [rows[0]!.id],
    );
  } finally {
    await pool.end();
  }
}

test("un'azienda verificata scrive un'offerta a norma e la invia", async ({ page, request }) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const vat = syntheticVat();

  await signUp(page, request, newTestEmail("offerte"), "azienda");
  await page.goto("/account");
  await enableTwoFactor(page);
  await page.getByRole("link", { name: "Ho salvato i codici, continua" }).click();
  await page.getByLabel("Partita IVA").fill(vat);
  await page.getByLabel("Nome che vedranno i candidati").fill("Bar Finto");
  await page.getByRole("button", { name: "Registra l'azienda" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Bar Finto" })).toBeVisible();

  await verifyCompanyWithSite(vat);
  await page.reload();
  await page.getByRole("link", { name: "Nuova offerta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nuova offerta" })).toBeVisible();

  await page.getByLabel("Titolo dell'offerta").fill("Barista (m/f)");
  // Mansione con parole di tutti i giorni: "barman" → Barista.
  const occupation = page.getByRole("combobox", { name: "Mansione" });
  await occupation.fill("barman");
  await page.getByRole("option", { name: /^Barista/ }).click();
  await expect(page.getByText(/^Scelta: Barista/)).toBeVisible();

  const description = page.getByLabel("Descrizione");
  await description.fill(
    "Servizio al banco e caffetteria, turni dal lunedì al sabato. Esperienza minima di un anno. Età massima 30 anni.",
  );
  // Il controllo dal vivo segnala il limite di età prima ancora di inviare.
  const check = page.getByRole("region", { name: "Controllo dell'annuncio" });
  await expect(check).toContainText("Non si possono chiedere limiti di età");

  await description.fill(
    "Servizio al banco e caffetteria, turni dal lunedì al sabato. Esperienza minima di un anno nel ruolo.",
  );
  await expect(check).not.toContainText("limiti di età");
  await expect(check).toContainText("Le prime 3 offerte di ogni azienda passano da un moderatore");
  await page.getByLabel("Da (€)").fill("1.350");

  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page).toHaveURL(/\/azienda\/offerte\/[0-9a-f-]{36}\?esito=pending_review$/);
  await expect(page.getByRole("status")).toContainText("la controlla un moderatore");

  await page.getByRole("link", { name: "Torna all'area azienda" }).click();
  const list = page.getByRole("listitem").filter({ hasText: "Barista (m/f)" });
  await expect(list).toContainText("In moderazione");
});
