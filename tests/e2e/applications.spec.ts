import { createHash, randomInt } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, MAILPIT, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-019: il lavoratore si candida; l'azienda riceve un'email senza dati personali,
// apre la candidatura (dati decifrati per lei) e aggiorna lo stato, che il lavoratore vede.

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

async function seedOffer(ownerId: string, title: string): Promise<string> {
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
       values ($1, 'FINTA SRL', 'Enoteca Finta', 'verified', now()) returning id`,
      [`6${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    const companyId = rows[0]!.id;
    await pool.query(
      `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
      [companyId, ownerId],
    );
    const offer = await pool.query<{ id: string }>(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_period, published_at, valid_through)
       values ($1, $2, $3, 'Servizio al banco e ai tavoli, turni serali.', '098031', 'permanent', 'shifts',
         'published', 1450, 'month', now() - interval '1 day', now() + interval '29 days') returning id`,
      [companyId, title, occ.rows[0]!.id],
    );
    return offer.rows[0]!.id;
  });
}

async function lastMailTo(request: import("@playwright/test").APIRequestContext, to: string) {
  let found: { Subject: string; Text: string } | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"Nuova candidatura"` },
        });
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages[0]) return false;
        const msg = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
        found = (await msg.json()) as { Subject: string; Text: string };
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

test("candidatura: dal lavoratore all'azienda e ritorno", async ({ browser, request }) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const title = `Sommelier ${randomInt(100_000, 1_000_000)}`;

  // Azienda: titolare con 2FA e un'offerta pubblicata.
  const companyContext = await browser.newContext();
  const company = await companyContext.newPage();
  const ownerEmail = newTestEmail("titolare");
  await signUp(company, request, ownerEmail, "azienda");
  await enableTwoFactor(company);
  const offerId = await seedOffer(await userOf(companyContext), title);

  // Lavoratore: profilo minimo, poi candidatura con messaggio.
  const workerContext = await browser.newContext();
  const worker = await workerContext.newPage();
  await signUp(worker, request, newTestEmail("candidata"), "lavoratore");
  await worker.goto(`/offerte/${offerId}`);
  await worker.getByRole("link", { name: "Completa il profilo" }).click();
  await worker.getByLabel("Nome", { exact: true }).fill("Carlottafinta");
  await worker.getByLabel("Cognome").fill("Esempiofinta");
  await worker.getByRole("combobox", { name: "Mansione principale" }).fill("barman");
  await worker.getByRole("option", { name: /^Barista/ }).click();
  await worker.getByLabel("Il tuo comune").fill("Lodi");
  await worker.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(worker.getByRole("status")).toContainText("Profilo salvato.");

  await worker.goto(`/offerte/${offerId}`);
  await worker
    .getByLabel("Messaggio per l'azienda (facoltativo)")
    .fill("Posso iniziare dal primo del mese.");
  await worker.getByRole("button", { name: "Candidati con il tuo profilo" }).click();
  await expect(worker.getByRole("status")).toContainText("Candidatura inviata!");
  await worker.goto("/candidature");
  await expect(worker.getByRole("article", { name: title })).toContainText("Inviata");

  // Email all'azienda: titolo dell'offerta e link, nessun dato della candidata.
  const mail = await lastMailTo(request, ownerEmail);
  expect(mail.Subject).toBe(`Nuova candidatura per «${title}»`);
  expect(mail.Text).toContain(`/azienda/candidature?offerta=${offerId}`);
  for (const secret of ["Carlottafinta", "Esempiofinta", "primo del mese"]) {
    expect(`${mail.Subject}${mail.Text}`).not.toContain(secret);
  }

  // L'azienda apre la candidatura e decide.
  await company.goto(`/azienda/candidature?offerta=${offerId}`);
  await expect(
    company.getByRole("heading", { level: 1, name: `Candidature per «${title}»` }),
  ).toBeVisible();
  await expect(company.getByText("Carlottafinta")).toHaveCount(0);
  await company.getByRole("link", { name: "Apri la candidatura 1" }).click();
  await expect(
    company.getByRole("heading", { level: 1, name: "Carlottafinta Esempiofinta" }),
  ).toBeVisible();
  await expect(company.getByText("Posso iniziare dal primo del mese.")).toBeVisible();
  await expect(company.getByRole("link", { name: /@esempio\.it$/ })).toBeVisible();
  await company.getByRole("button", { name: "Lo contatteremo" }).click();
  await expect(company.getByRole("status")).toContainText("Stato aggiornato");

  await worker.reload();
  const card = worker.getByRole("article", { name: title });
  await expect(card).toContainText("L'azienda ti contatterà");
  await expect(card).toContainText("vista il");

  await companyContext.close();
  await workerContext.close();
});
