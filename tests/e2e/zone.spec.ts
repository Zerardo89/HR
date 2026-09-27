import { createHash, randomInt } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-016: luogo di lavoro in un "altro comune". In zona (Lodi, a ~29 km dalla sede di
// Piacenza) si pubblica gratis; fuori zona (Milano, ~60 km e altra regione) serve il Piano Nazionale.
// L'azienda risulta registrata il 10/01/2027: non è fondatrice, così il test non dipende dalla data di oggi.

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

async function seedCompany(ownerId: string, name: string): Promise<string> {
  return withDb(async (pool) => {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
         ('015','Milano','MI','03'), ('098','Lodi','LO','03'), ('033','Piacenza','PC','08') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
         ('015146','Milano','015','03',45.4642,9.1900), ('098031','Lodi','098','03',45.3097,9.5037),
         ('033032','Piacenza','033','08',45.0526,9.6934) on conflict do nothing`,
    );
    const { rows } = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at, created_at)
       values ($1, 'FINTA SRL', $2, 'verified', now(), '2027-01-10T10:00:00Z') returning id`,
      [`1${String(randomInt(0, 1e9)).padStart(10, "0")}`, name],
    );
    const companyId = rows[0]!.id;
    await pool.query(
      `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
      [companyId, ownerId],
    );
    await pool.query(
      `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
       values ($1, '033032', 'Sede legale', true, now())`,
      [companyId],
    );
    return companyId;
  });
}

async function fillOffer(page: Page, title: string) {
  await page.getByLabel("Titolo dell'offerta").fill(title);
  await page.getByRole("combobox", { name: "Mansione" }).fill("barman");
  await page.getByRole("option", { name: /^Barista/ }).click();
  await page
    .getByLabel("Descrizione")
    .fill(
      "Servizio al banco e caffetteria, turni dal lunedì al sabato. Esperienza minima di un anno nel ruolo.",
    );
  await page.getByLabel("Da (€)").fill("1.350");
}

test("altro comune: in zona si pubblica, fuori zona serve il Piano Nazionale", async ({
  page,
  request,
  context,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const name = `Caffè Finto ${String.fromCharCode(65 + randomInt(0, 26))}`;
  await signUp(page, request, newTestEmail("zona"), "azienda");
  await enableTwoFactor(page);
  const companyId = await seedCompany(await userOf(context), name);

  await page.goto("/azienda");
  await expect(page.getByText(/Piano:\s*Gratis nella tua zona/)).toBeVisible();

  // In zona: Lodi è in un'altra regione ma a meno di 50 km dalla sede di Piacenza.
  await page.goto(`/azienda/offerte/nuova?azienda=${companyId}`);
  await fillOffer(page, "Barista (m/f) Lodi");
  await page.getByLabel("Luogo di lavoro").selectOption({ label: "Altro comune…" });
  await page.getByLabel("Comune del luogo di lavoro").fill("Lodii");
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Scegli il comune giusto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lodi (LO)" }).click();
  await expect(page.getByLabel("Comune del luogo di lavoro")).toHaveValue("Lodi (LO)");
  await page.getByRole("button", { name: "Pubblica" }).click();
  // Le prime offerte di un'azienda passano dal moderatore: ma non sono bloccate dalla zona.
  await expect(page).toHaveURL(/\?esito=pending_review$/);

  // Fuori zona senza piano: resta bozza, con il motivo.
  await page.goto(`/azienda/offerte/nuova?azienda=${companyId}`);
  await fillOffer(page, "Barista (m/f) Milano");
  await page.getByLabel("Luogo di lavoro").selectOption({ label: "Altro comune…" });
  await page.getByLabel("Comune del luogo di lavoro").fill("Milano");
  await page.getByRole("button", { name: "Pubblica" }).click();
  const blocked = page.getByRole("alert").filter({ hasText: "fuori dalla zona gratuita" });
  await expect(blocked).toBeVisible();

  const offers = () =>
    withDb(async (pool) => {
      const { rows } = await pool.query<{
        title: string;
        status: string;
        scope: string;
        municipality_code: string;
        updated_at: Date;
      }>(
        `select title, status, scope, municipality_code, updated_at from job_offers
         where company_id = $1 order by title`,
        [companyId],
      );
      return rows;
    });
  const milanoUpdatedAt = async () =>
    (await offers()).find((o) => o.title.endsWith("Milano"))?.updated_at.getTime() ?? 0;
  const firstSave = await milanoUpdatedAt();
  expect(firstSave).toBeGreaterThan(0);

  // Riprovare aggiorna la stessa bozza (con gli stessi valori scelti): nessuna offerta doppia.
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect.poll(milanoUpdatedAt).toBeGreaterThan(firstSave);
  await expect(blocked).toBeVisible();
  expect(
    (await offers()).map(({ title, status, scope, municipality_code }) => ({
      title,
      status,
      scope,
      municipality_code,
    })),
  ).toEqual([
    {
      title: "Barista (m/f) Lodi",
      status: "pending_review",
      scope: "local",
      municipality_code: "098031",
    },
    {
      title: "Barista (m/f) Milano",
      status: "draft",
      scope: "national",
      municipality_code: "015146",
    },
  ]);
});
