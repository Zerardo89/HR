import { createHash, randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { MAILPIT, mailpitReachable, newTestEmail, runWorkerJob, seedLodi, signUp } from "./helpers";

// Test di accettazione WP-020: avviso creato dalla ricerca, job del worker, email con disiscrizione
// "un clic" (RFC 8058) e pagina di conferma (R-MAIL-02).

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

/** Un'offerta nuova per la parola cercata e l'avviso "controllato" ieri: il giro di oggi la manda. */
async function newOfferAndYesterday(userId: string, word: string): Promise<string> {
  return withDb(async (pool) => {
    const occ = await pool.query<{ id: number }>(`select id from occupations order by id limit 1`);
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Cantina Finta', 'verified', now()) returning id`,
      [`5${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    const offer = await pool.query<{ id: string }>(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_period, published_at, valid_through)
       values ($1, $2, $3, 'Servizio in cantina.', '098031', 'permanent', 'full_time', 'published', 1500, 'month',
         now() - interval '1 hour', now() + interval '30 days') returning id`,
      [company.rows[0]!.id, `Cantiniere ${word}`, occ.rows[0]!.id],
    );
    await pool.query(
      `update saved_searches set checked_until = now() - interval '1 day' where user_id = $1`,
      [userId],
    );
    return offer.rows[0]!.id;
  });
}

type AlertMail = { text: string; listUnsubscribe: string; oneClick: string };

/**
 * Email di avviso per `to` che contiene `offerId`. Mobile e desktop girano in parallelo e ognuno lancia il job:
 * la stessa persona può ricevere un doppione, quindi si cerca l'email del giro giusto, non "la prossima".
 */
async function alertMailTo(request: APIRequestContext, to: string, offerId: string) {
  let found: AlertMail | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"per le tue ricerche"` },
        });
        const { messages } = (await res.json()) as { messages: { ID: string }[] };
        for (const { ID } of messages.slice(0, 5)) {
          const msg = (await (await request.get(`${MAILPIT}/api/v1/message/${ID}`)).json()) as {
            Text: string;
          };
          if (!msg.Text.includes(offerId)) continue;
          const headers = (await (
            await request.get(`${MAILPIT}/api/v1/message/${ID}/headers`)
          ).json()) as Record<string, string[]>;
          found = {
            text: msg.Text,
            listUnsubscribe: headers["List-Unsubscribe"]?.[0] ?? "",
            oneClick: headers["List-Unsubscribe-Post"]?.[0] ?? "",
          };
          return true;
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

test("avvisi: dalla ricerca all'email, disiscrizione con un clic e dalla pagina", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  test.setTimeout(120_000);
  const appUrl = String(testInfo.project.use.baseURL);
  const word = Array.from({ length: 9 }, () => String.fromCharCode(97 + randomInt(0, 26))).join("");
  const email = newTestEmail("avvisi");

  await seedLodi();
  await signUp(page, request, email, "lavoratore");
  const createAlert = async () => {
    await page.goto(`/offerte?q=${word}&dove=lodi`);
    await page.getByRole("radio", { name: "Una volta a settimana" }).check();
    await page.getByRole("radio", { name: "Ogni giorno" }).check();
    await page.getByRole("button", { name: "Crea l'avviso" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Avviso creato" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Avviso 1" })).toContainText(
      `«${word}» · Lodi (LO), entro 20 km`,
    );
  };
  await createAlert();
  await page.goto(`/offerte?q=${word}&dove=Lodi`);
  await expect(page.getByText("Hai già un avviso per questa ricerca.")).toBeVisible();

  // Giro del worker: email con l'offerta nuova e le intestazioni RFC 8058.
  const userId = await userOf(page.context());
  const offerId = await newOfferAndYesterday(userId, word);
  runWorkerJob("alerts.send", appUrl);
  const first = await alertMailTo(request, email, offerId);
  expect(first.text).toContain(`${appUrl}/offerte/${offerId}`);
  expect(first.oneClick).toBe("List-Unsubscribe=One-Click");
  const oneClickUrl = /^<(.+)>$/.exec(first.listUnsubscribe)![1]!;
  const pageUrl = /(\S+\/avvisi\/disiscrizione\?token=[\w-]+)/.exec(first.text)![1]!;

  // Aprire il link non cambia nulla (antivirus e anteprime lo aprono da soli).
  await page.goto(pageUrl);
  await expect(page.getByRole("heading", { name: "Non vuoi più ricevere avvisi?" })).toBeVisible();
  await page.goto("/avvisi");
  await expect(page.getByRole("article", { name: "Avviso 1" })).toBeVisible();

  // Il programma di posta fa il POST "un clic": via gli avvisi.
  const res = await request.post(oneClickUrl, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  expect(res.status()).toBe(200);
  await page.goto("/avvisi");
  await expect(page.getByText("Non hai ancora avvisi.")).toBeVisible();
  await page.goto(pageUrl);
  await expect(page.getByRole("status")).toContainText("La disiscrizione è già fatta");

  // Di nuovo, con il pulsante della pagina di conferma.
  await createAlert();
  const secondOfferId = await newOfferAndYesterday(userId, word);
  runWorkerJob("alerts.send", appUrl);
  const second = await alertMailTo(request, email, secondOfferId);
  await page.goto(/(\S+\/avvisi\/disiscrizione\?token=[\w-]+)/.exec(second.text)![1]!);
  await page.getByRole("button", { name: "Sì, non voglio più avvisi" }).click();
  await expect(page.getByRole("status")).toContainText("Fatto: non riceverai più avvisi");
  await page.goto("/avvisi");
  await expect(page.getByText("Non hai ancora avvisi.")).toBeVisible();
});

test("avvisi: chi non è entrato è invitato ad accedere", async ({ page }) => {
  await page.goto("/offerte?q=cameriere");
  const box = page.getByRole("region", { name: "Ricevi le nuove offerte via email" });
  await expect(box.getByRole("link", { name: "Entra per ricevere avvisi" })).toBeVisible();
});
