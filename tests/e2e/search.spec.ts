import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

// Test di accettazione WP-015: un visitatore trova un'offerta cercando per parole e comune (traguardo M2),
// vede perché la vede, corregge un comune scritto male, restringe con distanza e filtri.

async function seedOffer(token: string): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    // Con `fullyParallel` il beforeAll può ripartire nello stesso worker: una sola offerta per parola.
    const existing = await pool.query(`select 1 from job_offers where title = $1`, [
      `Magazziniere/a ${token}`,
    ]);
    if (existing.rowCount) return;
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
         ('015','Milano','MI','03'), ('098','Lodi','LO','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
         ('015146','Milano','015','03',45.4642,9.1900), ('098031','Lodi','098','03',45.3097,9.5037)
       on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(`select id from occupations order by id limit 1`);
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Magazzini Finti', 'verified', now()) returning id`,
      [`4${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    await pool.query(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_period, published_at, valid_through)
       values ($1, $2, $3, 'Carico e scarico merci, turno di notte.', '098031', 'permanent', 'shifts',
         'published', 1500, 'month', now() - interval '1 day', now() + interval '29 days')`,
      [company.rows[0]!.id, `Magazziniere/a ${token}`, occ.rows[0]!.id],
    );
  } finally {
    await pool.end();
  }
}

test.describe("ricerca delle offerte", () => {
  // Parola di sole lettere a caso: codici come «rif397059» e «rif397884» si somigliano (trigrammi) e la
  // ricerca di uno troverebbe anche l'offerta dell'altro worker.
  const token = Array.from({ length: 9 }, () => String.fromCharCode(97 + randomInt(0, 26))).join(
    "",
  );
  const title = `Magazziniere/a ${token}`;

  test.beforeAll(async () => {
    test.skip(!process.env.DATABASE_URL && !process.env.CI, "Serve DATABASE_URL");
    await seedOffer(token);
  });

  test("cerca per parole e comune: risultato con stipendio e perché la vedi", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Cerca lavoro" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cerca lavoro" })).toBeVisible();

    await page.getByLabel("Cosa").fill(token);
    await page.getByLabel("Dove").fill("Milno");
    await page.getByLabel("Distanza massima").selectOption("50");
    await page.getByRole("button", { name: "Cerca" }).click();

    // Comune scritto male: la pagina lo dice e propone quello giusto.
    await expect(page.getByRole("status")).toContainText("Non troviamo il comune «Milno»");
    await page.getByRole("link", { name: "Milano (MI)" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "1 offerta" })).toBeVisible();
    await expect(page.getByText("Entro 50 km da Milano (MI).")).toBeVisible();
    const card = page.getByRole("article", { name: title });
    await expect(card.getByText("Magazzini Finti")).toBeVisible();
    await expect(card.getByText("Lodi (LO)")).toBeVisible();
    await expect(card.getByText(/1500\s€ lordi al mese/)).toBeVisible();
    await expect(card).toContainText(
      "Perché la vedi: Le parole cercate sono nel titolo · A 30 km · Pubblicata ieri",
    );

    await card.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });

  test("la distanza e i filtri restringono i risultati", async ({ page }) => {
    await page.goto(`/offerte?q=${token}&dove=Milano&raggio=20`);
    await expect(page.getByRole("heading", { level: 2, name: "Nessuna offerta" })).toBeVisible();

    await page.goto(`/offerte?q=${token}&dove=Lodi`);
    await expect(page.getByRole("article", { name: title })).toBeVisible();
    await page.getByText("Altri filtri").click();
    await page.getByLabel("Stagionale").check();
    await page.getByRole("button", { name: "Cerca" }).click();
    await expect(page).toHaveURL(/contratto=seasonal/);
    await expect(page.getByRole("heading", { level: 2, name: "Nessuna offerta" })).toBeVisible();
    // I risultati filtrati non si indicizzano.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("come ordiniamo le offerte: pesi pubblici", async ({ page }) => {
    await page.goto("/offerte");
    await page.getByRole("link", { name: "Come ordiniamo le offerte" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Come ordiniamo le offerte" }),
    ).toBeVisible();
    const row = page.getByRole("row", { name: /Mansione/ }).first();
    await expect(row.getByRole("cell").first()).toHaveText("40");
  });
});
