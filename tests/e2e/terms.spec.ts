import { createHash } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-024b (R-DSA-01/02, DSA art. 11-14): condizioni versionate con regolamento degli
// annunci e moderazione, archivio delle versioni, nuova accettazione dopo un aggiornamento, punto di contatto.

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

test("condizioni d'uso: versione in vigore, regolamento, moderazione e versioni precedenti", async ({
  page,
}) => {
  await page.goto("/condizioni");
  await expect(page.getByRole("heading", { level: 1, name: "Condizioni d'uso" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("BOZZA");
  await expect(page.getByText(/^Versione in vigore dal \d{1,2} \w+ \d{4}\.$/)).toBeVisible();
  await expect(page.locator("#regolamento-annunci")).toHaveText("4. Regolamento degli annunci");
  await expect(page.locator("#moderazione")).toHaveText("5. Come controlliamo gli annunci");
  await expect(page.getByText(/non usiamo intelligenza artificiale/)).toBeVisible();

  await page.getByRole("link", { name: /^27 settembre 2026$/ }).click();
  await expect(page).toHaveURL(/\/condizioni\?versione=bozza-2026-09-27$/);
  await expect(
    page.getByText("Versione del 27 settembre 2026: non è più in vigore."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leggi la versione in vigore" }).click();
  await expect(page.getByText(/^Versione in vigore dal/)).toBeVisible();
});

test("dopo un aggiornamento delle condizioni si accettano di nuovo, una volta", async ({
  page,
  request,
  context,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const banner = page.getByRole("region", { name: "Condizioni d'uso aggiornate" });
  await signUp(page, request, newTestEmail("condizioni"), "lavoratore");
  await expect(banner).toHaveCount(0); // appena accettate alla registrazione

  // Come se l'utente avesse accettato solo la versione precedente.
  const userId = await userOf(context);
  await withDb((pool) =>
    pool.query(
      `update consents set version = 'bozza-2026-09-27' where user_id = $1 and type = 'terms'`,
      [userId],
    ),
  );
  await page.goto("/offerte");
  await expect(banner).toContainText("Abbiamo aggiornato le condizioni d'uso.");
  await banner.getByRole("button", { name: "Accetto" }).click();
  await expect(banner).toHaveCount(0);
  await page.goto("/account");
  await expect(banner).toHaveCount(0);
  const versions = await withDb(async (pool) => {
    const { rows } = await pool.query<{ version: string }>(
      `select version from consents where user_id = $1 and type = 'terms' order by granted_at`,
      [userId],
    );
    return rows.map((r) => r.version);
  });
  expect(versions).toEqual(["bozza-2026-09-27", "bozza-2026-09-28"]);
});

test("punto di contatto unico per utenti e autorità", async ({ page }) => {
  await page.goto("/contatti");
  await expect(page.getByText(/Punto di contatto unico/)).toBeVisible();
  await expect(page.getByText("italiano e inglese")).toBeVisible();
  await expect(page.getByRole("link", { name: "Come segnalare" })).toHaveAttribute(
    "href",
    "/segnalazioni",
  );
});
