import { createHash, randomInt } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { enableTwoFactor, MAILPIT, mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-011c: il titolare aggiunge una sede (in attesa del moderatore) e invita un collega,
// che accetta dal link dell'email dopo essersi registrato; il moderatore approva una sede dal pannello.

async function withDb<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** L'utente della sessione del browser (hash del token del cookie), non "l'ultimo creato". */
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

/** Azienda verificata con sede legale a Piacenza; `ownerId` ne è il titolare. */
async function seedCompany(name: string, ownerId?: string): Promise<string> {
  return withDb(async (pool) => {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
         ('098','Lodi','LO','03'), ('033','Piacenza','PC','08') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
         ('098031','Lodi','098','03',45.3097,9.5037), ('033032','Piacenza','033','08',45.0526,9.6934)
       on conflict do nothing`,
    );
    const { rows } = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', $2, 'verified', now()) returning id`,
      [`2${String(randomInt(0, 1e9)).padStart(10, "0")}`, name],
    );
    const companyId = rows[0]!.id;
    await pool.query(
      `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
       values ($1, '033032', 'Sede legale', true, now())`,
      [companyId],
    );
    if (ownerId) {
      await pool.query(
        `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
        [companyId, ownerId],
      );
    }
    return companyId;
  });
}

/** Link dell'invito dall'ultima email ricevuta da `to` (Mailpit). */
async function inviteLink(request: import("@playwright/test").APIRequestContext, to: string) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages[0]) return false;
        const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
        const { Text } = (await message.json()) as { Text: string };
        link = /https?:\/\/\S+\/invito\/[A-Za-z0-9_-]{43}/.exec(Text)?.[0];
        return link !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return new URL(link!).pathname;
}

test.beforeEach(async ({ request }) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
});

test("il titolare aggiunge una sede e invita un collega, che accetta dal link dell'email", async ({
  page,
  request,
  context,
  browser,
}) => {
  const companyName = `Osteria Finta ${String.fromCharCode(65 + randomInt(0, 26))}`;
  await signUp(page, request, newTestEmail("titolare"), "azienda");
  await enableTwoFactor(page);
  await seedCompany(companyName, await userOf(context));

  // Sede operativa con il comune scritto male: la pagina propone quello giusto.
  await page.goto("/azienda");
  await page.getByRole("link", { name: "Sedi" }).click();
  await page.getByLabel("Nome della sede").fill("Magazzino");
  await page.getByLabel("Comune").fill("Lodii");
  await page.getByRole("button", { name: "Aggiungi la sede" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Non troviamo questo comune." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lodi (LO)" }).click();
  await expect(page.getByLabel("Comune")).toHaveValue("Lodi (LO)");
  await page.getByRole("button", { name: "Aggiungi la sede" }).click();
  await expect(page.getByRole("status")).toContainText("la controlla un moderatore");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Magazzino · Lodi (LO)" }),
  ).toContainText("In attesa di approvazione");

  // Invito a un collega.
  const colleague = newTestEmail("collega");
  await page.getByRole("link", { name: "Torna all'area azienda" }).click();
  await page.getByRole("link", { name: "Colleghi" }).click();
  await page.getByLabel("Email del collega").fill(colleague);
  await page.getByRole("button", { name: "Invia l'invito" }).click();
  await expect(page.getByRole("status")).toContainText("Invito spedito.");
  await expect(page.getByRole("heading", { name: "Inviti in attesa (1 su 10)" })).toBeVisible();

  // Il collega apre il link, si registra come azienda con quell'email, attiva la 2FA e accetta.
  const link = await inviteLink(request, colleague);
  const other = await browser.newContext();
  const guest = await other.newPage();
  await guest.goto(link);
  await expect(guest.getByText(`${companyName} ti invita a gestire le sue offerte`)).toBeVisible();
  await guest.getByRole("button", { name: "Accedi o registrati per accettare" }).click();
  await expect(guest).toHaveURL(/\/accedi/);
  await signUp(guest, request, colleague, "azienda");
  await enableTwoFactor(guest);
  await guest.goto("/azienda");
  await expect(guest.getByText(`Hai un invito di ${companyName} in sospeso.`)).toBeVisible();
  await guest.getByRole("link", { name: "Apri l'invito" }).click();
  await guest.getByRole("button", { name: `Unisciti a ${companyName}` }).click();
  await expect(
    guest.getByRole("status").filter({ hasText: "ora fai parte dell'azienda" }),
  ).toBeVisible();
  await expect(guest.getByRole("heading", { level: 2, name: companyName })).toBeVisible();
  // Il collega gestisce le offerte ma non invita altri.
  await expect(guest.getByRole("link", { name: "Colleghi" })).toHaveCount(0);
  await other.close();
});

test("il moderatore approva una sede dal pannello", async ({ page, request, context }) => {
  const companyName = `Bottega Finta ${String.fromCharCode(65 + randomInt(0, 26))}${randomInt(0, 1e6)}`;
  const companyId = await seedCompany(companyName);
  const siteId = await withDb(async (pool) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into company_sites (company_id, municipality_code, label) values ($1, '098031', 'Negozio') returning id`,
      [companyId],
    );
    return rows[0]!.id;
  });

  await signUp(page, request, newTestEmail("moderatore"), "lavoratore");
  const userId = await userOf(context);
  await withDb((pool) => pool.query(`update users set role = 'moderator' where id = $1`, [userId]));
  await page.goto("/moderazione");
  await enableTwoFactor(page);
  await page.goto("/moderazione");

  const card = page.getByRole("article", { name: `${companyName} · Negozio` });
  await expect(card).toContainText("Lodi (LO)");
  await expect(card).toContainText("dalla sede legale (Piacenza), altra regione");
  await card.getByRole("button", { name: "Approva la sede" }).click();
  await expect(page.getByRole("status")).toContainText("Sede approvata.");

  const approved = await withDb(async (pool) => {
    const { rows } = await pool.query(`select approved_at from company_sites where id = $1`, [
      siteId,
    ]);
    return rows[0].approved_at;
  });
  expect(approved).not.toBeNull();
});
