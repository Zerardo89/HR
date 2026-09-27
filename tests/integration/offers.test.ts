import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OfferInput } from "@/modules/offers/domain";
import { listOffersForCompany } from "@/modules/offers/server/queries";
import { saveOffer } from "@/modules/offers/server/save-offer";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-013 (salvataggio e pubblicazione delle offerte) sul DB reale. NON modificarli.

let pool: Pool;
let occupationId: number;
const now = new Date("2026-11-02T09:00:00Z");
const deps = () => ({ db: drizzle(pool), now: () => now });
const created = { users: [] as string[], companies: [] as string[] };

async function companyWithSite(publishedOffers = 0) {
  const user = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ('company_member', $1, 'v1.finto', 1, now()) returning id`,
    [`test-bidx-${randomUUID()}`],
  );
  const userId = user.rows[0]!.id;
  created.users.push(userId);
  const vat = `9${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`;
  const company = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'AZIENDA FINTA SRL', 'Trattoria Finta', 'verified', now()) returning id`,
    [vat],
  );
  const companyId = company.rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
    [companyId, userId],
  );
  const site = await pool.query<{ id: string }>(
    `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
     values ($1, '015146', 'Sede legale', true, now()) returning id`,
    [companyId],
  );
  for (let i = 0; i < publishedOffers; i++) {
    await pool.query(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code,
         contract_type, schedule, status, salary_min, salary_period)
       values ($1, 'Offerta chiusa', $2, 'Testo', '015146', 'permanent', 'full_time', 'closed', 1400, 'month')`,
      [companyId, occupationId],
    );
  }
  return { userId, companyId, siteId: site.rows[0]!.id };
}

const input = (
  c: { companyId: string; siteId: string },
  over: Partial<OfferInput> = {},
): OfferInput => ({
  companyId: c.companyId,
  siteId: c.siteId,
  occupationId,
  title: "Cameriere/a di sala",
  description:
    "Servizio ai tavoli, pranzo e cena, 5 giorni su 7. Esperienza di almeno 2 anni in ristorazione. " +
    "Ottima conoscenza dell'italiano.",
  contractType: "fixed_term",
  schedule: "full_time",
  hoursPerWeek: 40,
  salaryMin: 1400,
  salaryMax: 1600,
  salaryPeriod: "month",
  salaryBasis: "gross",
  ccnl: "Turismo - Pubblici esercizi",
  validDays: 30,
  internshipDeclaration: false,
  ...over,
});

async function offerRow(id: string) {
  const { rows } = await pool.query(`select * from job_offers where id = $1`, [id]);
  return rows[0];
}

describe.skipIf(!DATABASE_URL)("offerte: salvataggio e pubblicazione (WP-013)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
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
    const occ = await pool.query<{ id: number }>(
      `insert into occupations (slug, category, label_it, isco_code, group_code)
       values ('test-offerte-cameriere', 'ristorazione', 'Cameriere di prova', '5131', '513')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("azienda nuova: un'offerta a norma va in moderazione (prime 3 offerte), con i giorni di validità chiesti", async () => {
    const c = await companyWithSite(0);
    const result = await saveOffer(deps(), c.userId, input(c), "publish");
    expect(result).toMatchObject({ status: "saved", offerStatus: "pending_review" });
    if (result.status !== "saved") return;
    const row = await offerRow(result.offerId);
    expect(row.status).toBe("pending_review");
    expect(row.published_at).toBeNull();
    expect(row.municipality_code).toBe("015146");
    expect(row.moderation).toMatchObject({ validDays: 30, issues: [{ code: "first_offers" }] });
  });

  it("azienda con storico: l'offerta a norma si pubblica subito con scadenza entro 60 giorni", async () => {
    const c = await companyWithSite(3);
    const result = await saveOffer(deps(), c.userId, input(c, { validDays: 45 }), "publish");
    expect(result).toMatchObject({ status: "saved", offerStatus: "published", issues: [] });
    if (result.status !== "saved") return;
    const row = await offerRow(result.offerId);
    expect(row.published_at).toEqual(now);
    expect(row.valid_through).toEqual(new Date(now.getTime() + 45 * 24 * 60 * 60_000));
    expect(await listOffersForCompany(drizzle(pool), c.userId, c.companyId)).toHaveLength(4);
  });

  it("un annuncio discriminatorio non si pubblica: resta bozza e si dice perché", async () => {
    const c = await companyWithSite(3);
    const result = await saveOffer(
      deps(),
      c.userId,
      input(c, { description: `${input(c).description} Età massima 30 anni.` }),
      "publish",
    );
    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.issues.map((i) => i.code)).toContain("age_limit");
    expect((await offerRow(result.offerId)).status).toBe("draft");
  });

  it("la bozza si salva anche incompleta (senza stipendio) e si può modificare", async () => {
    const c = await companyWithSite(3);
    const draft = await saveOffer(
      deps(),
      c.userId,
      input(c, { salaryMin: undefined, salaryMax: undefined }),
      "draft",
    );
    expect(draft).toMatchObject({ status: "saved", offerStatus: "draft" });
    if (draft.status !== "saved") return;
    expect(draft.issues.map((i) => i.code)).toContain("salary_missing");

    const edited = await saveOffer(
      deps(),
      c.userId,
      input(c, { title: "Barista (m/f)" }),
      "publish",
      draft.offerId,
    );
    expect(edited).toMatchObject({
      status: "saved",
      offerStatus: "published",
      offerId: draft.offerId,
    });
    expect((await offerRow(draft.offerId)).title).toBe("Barista (m/f)");
    // Un'offerta pubblicata non si modifica da qui (si chiude o si rinnova: WP-022).
    expect(await saveOffer(deps(), c.userId, input(c), "publish", draft.offerId)).toEqual({
      status: "not_editable",
    });
  });

  it("autorizzazione: solo i membri dell'azienda, solo le sue sedi, solo mansioni esistenti", async () => {
    const a = await companyWithSite(0);
    const b = await companyWithSite(0);
    expect(await saveOffer(deps(), b.userId, input(a), "draft")).toEqual({ status: "not_allowed" });
    expect(
      await saveOffer(
        deps(),
        a.userId,
        input({ companyId: a.companyId, siteId: b.siteId }),
        "draft",
      ),
    ).toEqual({
      status: "invalid_site",
    });
    expect(
      await saveOffer(deps(), a.userId, input(a, { occupationId: 99_999_999 }), "draft"),
    ).toEqual({
      status: "invalid_occupation",
    });
    const mine = await saveOffer(deps(), a.userId, input(a), "draft");
    if (mine.status !== "saved") throw new Error(mine.status);
    expect(await saveOffer(deps(), b.userId, input(b), "draft", mine.offerId)).toEqual({
      status: "not_allowed",
    });
  });
});
