import { createHash, randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, MAILPIT, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-024a (DSA art. 16-17): segnalazione senza account → il moderatore toglie l'annuncio
// con una decisione motivata → l'offerta non c'è più → l'azienda riceve la motivazione.

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
       values ($1, 'FINTA SRL', 'Logistica Finta', 'verified', now()) returning id`,
      [`8${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    await pool.query(
      `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
      [rows[0]!.id, ownerId],
    );
    const offer = await pool.query<{ id: string }>(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_period, published_at, valid_through)
       values ($1, $2, $3, 'Carico e scarico merci.', '098031', 'permanent', 'full_time', 'published', 1400,
         'month', now() - interval '1 day', now() + interval '20 days') returning id`,
      [rows[0]!.id, title, occ.rows[0]!.id],
    );
    return offer.rows[0]!.id;
  });
}

async function mailTo(request: APIRequestContext, to: string, subject: string) {
  let found: { Subject: string; Text: string } | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"${subject}"` },
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

test("segnalazione senza account, decisione motivata del moderatore, offerta tolta", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const title = `Magazziniere/a ${randomInt(100_000, 1_000_000)}`;
  const facts = "L'annuncio chiede 150 euro per un corso obbligatorio prima del colloquio.";

  // Titolare dell'azienda: riceverà la motivazione.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const ownerEmail = newTestEmail("titolare-segnalato");
  await signUp(owner, request, ownerEmail, "azienda");
  const offerId = await seedOffer(await userOf(ownerContext), title);
  await ownerContext.close();

  // Chiunque, senza account: segnala dall'offerta.
  await page.goto(`/offerte/${offerId}`);
  await page.getByRole("link", { name: "Segnala questa offerta" }).click();
  await expect(page).toHaveURL(new RegExp(`/segnalazioni\\?offerta=${offerId}$`));
  await expect(page.getByText(`Offerta: «${title}» di Logistica Finta`)).toBeVisible();
  await page.getByLabel("Motivo").selectOption("payment_requested");
  await page.getByLabel(/Cosa non va/).fill("Scrivete a corso@esempio.it per pagare il corso.");
  await page.getByLabel(/Dichiaro in buona fede/).check();
  await page.getByRole("button", { name: "Invia la segnalazione" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Togli email e numeri di telefono" }),
  ).toBeVisible();
  await page.getByLabel(/Cosa non va/).fill("Chiedono 150 euro per un corso prima del colloquio.");
  await page.getByLabel(/Dichiaro in buona fede/).check();
  await page.getByRole("button", { name: "Invia la segnalazione" }).click();
  await expect(page.getByRole("status")).toContainText("la segnalazione è arrivata");

  // Moderatore (2FA obbligatoria): toglie l'annuncio con fondamento e fatti.
  const modContext = await browser.newContext();
  const mod = await modContext.newPage();
  await signUp(mod, request, newTestEmail("moderatore-segnalazioni"), "lavoratore");
  const modId = await userOf(modContext);
  await withDb((pool) => pool.query(`update users set role = 'moderator' where id = $1`, [modId]));
  await mod.goto("/moderazione");
  await enableTwoFactor(mod);
  await mod.goto("/moderazione");
  const card = mod.getByRole("article", { name: `Annuncio: ${title}` });
  await expect(card).toContainText("Chiedono 150 euro per un corso prima del colloquio.");
  await expect(card).toContainText("Chiede soldi, acquisti o dati bancari (1)");
  await card.getByLabel("Fondamento (lo legge l'azienda)").selectOption("payment_request");
  await card.getByLabel(/^Fatti/).fill(facts);
  await card.getByRole("button", { name: "Togli l'annuncio" }).click();
  await expect(mod.getByRole("status")).toContainText("Annuncio tolto");
  await expect(mod.getByRole("article", { name: `Annuncio: ${title}` })).toHaveCount(0);
  await modContext.close();

  // L'offerta non c'è più; l'azienda ha la motivazione con fatti, fondamento e rimedi.
  expect((await page.goto(`/offerte/${offerId}`))?.status()).toBe(404);
  const mail = await mailTo(request, ownerEmail, "Abbiamo tolto la tua offerta");
  expect(mail.Subject).toBe(`Abbiamo tolto la tua offerta «${title}»`);
  expect(mail.Text).toContain(facts);
  expect(mail.Text).toContain("D.Lgs. 276/2003 art. 11");
  expect(mail.Text).toContain("riesame entro 6 mesi");
});
