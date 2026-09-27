import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-017: il lavoratore compila il profilo; i dati identificativi sono cifrati nel DB,
// lui li rilegge (ogni lettura resta nel log di audit).

async function withDb<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

test("il lavoratore compila il profilo: nome e telefono cifrati, stato e mansione salvati", async ({
  page,
  request,
  context,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  await withDb(async (pool) => {
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
  });

  await signUp(page, request, newTestEmail("lavoratore"), "lavoratore");
  await page.getByRole("link", { name: "Il tuo profilo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Il tuo profilo" })).toBeVisible();
  await expect(page.getByText("I tuoi dati personali sono cifrati nel database.")).toBeVisible();

  await page.getByLabel("🟡 Ho un lavoro, ma sono aperto a proposte").check();
  await page.getByLabel("Nome", { exact: true }).fill("Giuseppina");
  await page.getByLabel("Cognome").fill("Esempiofinta");
  await page.getByLabel("Telefono (facoltativo)").fill("+39 320 555 0101");
  await page.getByRole("combobox", { name: "Mansione principale" }).fill("barman");
  await page.getByRole("option", { name: /^Barista/ }).click();
  await page.getByLabel("Esperienza nel lavoro che cerchi").selectOption("y3_5");
  await page.getByLabel("Il tuo comune").fill("Lodii");
  await page.getByRole("combobox", { name: "Lingua 1", exact: true }).selectOption("it");
  await page
    .getByRole("combobox", { name: "Livello lingua 1", exact: true })
    .selectOption("native");
  await page.getByLabel("Ruolo 1").fill("Barista");
  await page.getByLabel("Dove (esperienza 1)").fill("Bar Esempiofinto");

  await page.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Scegli il comune giusto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lodi (LO)" }).click();
  await page.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(page.getByRole("status")).toContainText("Profilo salvato.");

  // Riaprendo la pagina i dati tornano (decifrati per il lavoratore stesso).
  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Giuseppina");
  await expect(page.getByLabel("Il tuo comune")).toHaveValue("Lodi (LO)");
  await expect(page.getByLabel("🟡 Ho un lavoro, ma sono aperto a proposte")).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Mansione principale" })).toHaveValue(/Barista/);

  const token = (await context.cookies()).find((c) => c.name.endsWith("sessione"))!.value;
  const sessionId = createHash("sha256").update(token).digest("base64url");
  const { row, audits } = await withDb(async (pool) => {
    const profile = await pool.query(
      `select p.*, s.user_id as uid from worker_profiles p
       join auth_sessions s on s.user_id = p.user_id where s.id = $1`,
      [sessionId],
    );
    const audit = await pool.query<{ n: number }>(
      `select count(*)::int as n from audit_log
       where target_id = $1::text and action = 'pii.decrypt' and purpose = 'worker.self-view'`,
      [profile.rows[0].uid],
    );
    return { row: profile.rows[0], audits: audit.rows[0]!.n };
  });
  expect(row).toMatchObject({
    state: "open",
    municipality_code: "098031",
    experience_band: "y3_5",
  });
  const stored = JSON.stringify(row);
  for (const secret of ["Giuseppina", "Esempiofinta", "555 0101", "Bar Esempiofinto"]) {
    expect(stored).not.toContain(secret);
  }
  expect(audits).toBeGreaterThanOrEqual(1);
});
