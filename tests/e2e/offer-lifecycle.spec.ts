import { createHash, randomInt } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-022 (R-ANN-07): rinnovo negli ultimi 7 giorni dall'area azienda.

async function withDb<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function userOf(context: BrowserContext): Promise<string> {
  const token = (await context.cookies()).find((c) => c.name.endsWith("sessione"))!.value;
  const sessionId = createHash("sha256").update(token).digest("base64url");
  return withDb(async (pool) => {
    const { rows } = await pool.query<{ user_id: string }>(
      `select user_id from auth_sessions where id = $1`,
      [sessionId],
    );
    return rows[0]!.user_id;
  });
}

/** Azienda verificata del titolare con due offerte: una scade tra 3 giorni, l'altra tra 20. */
async function seedOffers(ownerId: string, suffix: string) {
  return withDb(async (pool) => {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('098','Lodi','LO','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('098031','Lodi','098','03',45.3097,9.5037) on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(`select id from occupations order by id limit 1`);
    const { rows } = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Forno Finto', 'verified', now()) returning id`,
      [`3${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    const companyId = rows[0]!.id;
    await pool.query(
      `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
      [companyId, ownerId],
    );
    const insert = (title: string, days: number) =>
      pool.query<{ id: string }>(
        `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
           schedule, status, salary_min, salary_period, published_at, valid_through)
         values ($1, $2, $3, 'Impasto e forno.', '098031', 'permanent', 'full_time', 'published', 1500, 'month',
           now() - interval '20 days', now() + make_interval(days => $4)) returning id`,
        [companyId, title, occ.rows[0]!.id, days],
      );
    const soon = (await insert(`Fornaio/a ${suffix}`, 3)).rows[0]!.id;
    const later = (await insert(`Aiuto fornaio/a ${suffix}`, 20)).rows[0]!.id;
    return { soon, later };
  });
}

test("rinnovo: negli ultimi 7 giorni si rinnova, prima no", async ({ page, request, context }) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  await signUp(page, request, newTestEmail("fornaio"), "azienda");
  await enableTwoFactor(page);
  const { soon, later } = await seedOffers(await userOf(context), String(randomInt(0, 1e6)));

  // Lontana dalla scadenza: si può solo chiudere.
  await page.goto(`/azienda/offerte/${later}`);
  await expect(page.getByText(/^Potrai rinnovarla dal /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Rinnova" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chiudi l'offerta" })).toBeVisible();

  // Vicina alla scadenza: rinnovo per 45 giorni.
  await page.goto(`/azienda/offerte/${soon}`);
  await page.getByLabel("Per quanti giorni").selectOption("45");
  await page.getByRole("button", { name: "Rinnova" }).click();
  await expect(page.getByRole("status")).toContainText("Offerta rinnovata: nuova scadenza il");
  await expect(page.getByRole("button", { name: "Rinnova" })).toHaveCount(0);
  const days = await withDb(async (pool) => {
    const { rows } = await pool.query<{ days: number }>(
      `select round(extract(epoch from valid_through - now()) / 86400)::int as days from job_offers where id = $1`,
      [soon],
    );
    return rows[0]!.days;
  });
  expect(days).toBe(45);
});
