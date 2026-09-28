import { createHash, randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { MAILPIT, mailpitReachable, newTestEmail, runWorkerJob, signUp } from "./helpers";

// Test di accettazione WP-021: il lavoratore "aperto" sceglie la mail mensile nel profilo; il job la spedisce;
// la risposta vale solo dopo la pagina di conferma (R-MAIL-02); disiscrizione "un clic" (RFC 8058).

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

/** Un'offerta di barista a Lodi pubblicata ieri, e la mail mensile "dovuta" da un'ora. */
async function seedOfferAndDue(userId: string, title: string): Promise<string> {
  return withDb(async (pool) => {
    const occ = await pool.query<{ id: number }>(
      `select occupation_id as id from profile_occupations where user_id = $1 limit 1`,
      [userId],
    );
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Caffè Finto', 'verified', now()) returning id`,
      [`1${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    const offer = await pool.query<{ id: string }>(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_period, published_at, valid_through)
       values ($1, $2, $3, 'Caffetteria.', '098031', 'permanent', 'full_time', 'published', 1400, 'month',
         now() - interval '1 day', now() + interval '29 days') returning id`,
      [company.rows[0]!.id, title, occ.rows[0]!.id],
    );
    await pool.query(
      `update worker_profiles set next_check_at = now() - interval '1 hour' where user_id = $1`,
      [userId],
    );
    return offer.rows[0]!.id;
  });
}

async function monthlyMailTo(request: APIRequestContext, to: string) {
  let found: { text: string; listUnsubscribe: string } | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"Stai ancora cercando lavoro"` },
        });
        const { messages } = (await res.json()) as { messages: { ID: string }[] };
        if (!messages[0]) return false;
        const id = messages[0].ID;
        const msg = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
          Text: string;
        };
        const headers = (await (
          await request.get(`${MAILPIT}/api/v1/message/${id}/headers`)
        ).json()) as Record<string, string[]>;
        found = { text: msg.Text, listUnsubscribe: headers["List-Unsubscribe"]?.[0] ?? "" };
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

test("mail mensile: dal profilo all'email, risposta confermata e disiscrizione", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  test.setTimeout(120_000);
  const email = newTestEmail("mensile");
  await signUp(page, request, email, "lavoratore");
  await page.goto("/profilo");
  await page.getByLabel("🟡 Ho un lavoro, ma sono aperto a proposte").check();
  await page.getByLabel("Nome", { exact: true }).fill("Mariafinta");
  await page.getByLabel("Cognome").fill("Mensilefinta");
  await page.getByRole("combobox", { name: "Mansione principale" }).fill("barman");
  await page.getByRole("option", { name: /^Barista/ }).click();
  await page.getByLabel("Il tuo comune").fill("Lodi");
  await page
    .getByLabel("Una volta al mese mandami le offerte migliori e chiedimi se sto ancora cercando.")
    .check();
  await page.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(page.getByRole("status")).toContainText("Profilo salvato.");

  const title = `Barista mensile ${randomInt(0, 1e6)}`;
  const offerId = await seedOfferAndDue(await userOf(page.context()), title);
  runWorkerJob("monthly.check", String(testInfo.project.use.baseURL));
  const mail = await monthlyMailTo(request, email);
  expect(mail.text).toContain(title);
  expect(mail.text).toContain(`/offerte/${offerId}`);
  expect(mail.text).not.toContain("Mariafinta"); // niente nome nella mail

  // Il link "resto visibile" apre una conferma: da solo non cambia nulla.
  const openLink = /(\S+\/mensile\?token=[\w-]+&scelta=aperto)/.exec(mail.text)![1]!;
  await page.goto(openLink);
  await expect(
    page.getByRole("heading", { name: "Confermi che resti occupata/o ma visibile?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sì, resto visibile" }).click();
  await expect(page.getByRole("status")).toContainText("Fatto: ci sentiamo fra un mese.");
  await page.goto(openLink);
  await expect(page.getByRole("status")).toContainText("Hai già risposto a questa email.");

  // Disiscrizione "un clic" dal programma di posta: la casella nel profilo si spegne.
  const res = await request.post(/^<(.+)>$/.exec(mail.listUnsubscribe)![1]!, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  expect(res.status()).toBe(200);
  await page.goto("/profilo");
  await expect(
    page.getByLabel(
      "Una volta al mese mandami le offerte migliori e chiedimi se sto ancora cercando.",
    ),
  ).not.toBeChecked();
});
