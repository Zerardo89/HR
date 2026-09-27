import { createHash, randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-013b: il moderatore (2FA obbligatoria) approva o rifiuta le offerte in attesa.
// Preparazione nel DB di prova: ruolo del moderatore e due offerte in moderazione di un'azienda verificata.

async function withDb<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function pendingOffers(titles: string[]) {
  await withDb(async (pool) => {
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
    const occ = await pool.query<{ id: number }>(`select id from occupations order by id limit 1`);
    const vat = `6${String(randomInt(0, 1e9)).padStart(10, "0")}`;
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Pizzeria Finta', 'verified', now()) returning id`,
      [vat],
    );
    for (const title of titles) {
      await pool.query(
        `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
           schedule, status, salary_min, salary_period, moderation)
         values ($1, $2, $3, 'Impasto e forno a legna, turni serali dal martedì alla domenica.', '015146',
           'permanent', 'shifts', 'pending_review', 1500, 'month', '{"validDays": 30}')`,
        [company.rows[0]!.id, title, occ.rows[0]!.id],
      );
    }
  });
}

test("il moderatore attiva la 2FA, approva un'offerta e ne rifiuta un'altra con motivo", async ({
  page,
  request,
  context,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const suffix = String(randomInt(0, 1e6));
  const approveTitle = `Pizzaiolo/a ${suffix}`;
  const rejectTitle = `Aiuto pizzaiolo/a ${suffix}`;
  await pendingOffers([approveTitle, rejectTitle]);

  const email = newTestEmail("moderatore");
  await signUp(page, request, email, "lavoratore");
  // Un lavoratore non entra nel pannello.
  await page.goto("/moderazione");
  await expect(page).toHaveURL(/\/$/);

  // Promozione a moderatore (come farebbe `pnpm users:role`): da qui la 2FA è obbligatoria.
  // L'utente si trova dalla SUA sessione (hash del token del cookie), non "l'ultima creata".
  const token = (await context.cookies()).find((c) => c.name.endsWith("sessione"))!.value;
  const sessionId = createHash("sha256").update(token).digest("base64url");
  await withDb((pool) =>
    pool.query(
      `update users set role = 'moderator' where id = (select user_id from auth_sessions where id = $1)`,
      [sessionId],
    ),
  );
  await page.goto("/moderazione");
  await enableTwoFactor(page);
  await page.goto("/moderazione");
  await expect(page.getByRole("heading", { level: 1, name: "Moderazione" })).toBeVisible();

  const approveCard = page.getByRole("article", { name: approveTitle, exact: true });
  await approveCard.getByRole("button", { name: "Approva e pubblica" }).click();
  await expect(page.getByRole("status")).toContainText("Offerta approvata e pubblicata");
  await expect(page.getByRole("article", { name: approveTitle, exact: true })).toHaveCount(0);

  const rejectCard = page.getByRole("article", { name: rejectTitle, exact: true });
  await rejectCard.getByLabel("Motivo (lo vede l'azienda)").selectOption("salary");
  await rejectCard
    .getByLabel(/Nota per l'azienda/)
    .fill("Indicare lo stipendio del contratto collettivo.");
  await rejectCard.getByRole("button", { name: "Rifiuta con motivo" }).click();
  await expect(page.getByRole("status")).toContainText("l'azienda vede il motivo");

  const statuses = await withDb((pool) =>
    pool.query<{ title: string; status: string }>(
      `select title, status from job_offers where title = any($1) order by title`,
      [[approveTitle, rejectTitle]],
    ),
  );
  expect(statuses.rows).toEqual([
    { title: rejectTitle, status: "draft" },
    { title: approveTitle, status: "published" },
  ]);
});
