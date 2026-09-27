import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OTHER_PLACE, type OfferInput } from "@/modules/offers/domain";
import { getOfferForMember } from "@/modules/offers/server/queries";
import { saveOffer } from "@/modules/offers/server/save-offer";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-016 (zona gratuita, Piano Nazionale, periodo fondatori) sul DB reale. NON modificarli.
// Sede legale a Piacenza (Emilia-Romagna). Lodi: altra regione a ~29 km. Milano: altra regione a ~60 km.
// Bologna: stessa regione a ~140 km.

let pool: Pool;
let occupationId: number;
const created = { users: [] as string[], companies: [] as string[] };
const deps = (now: Date) => ({ db: drizzle(pool), now: () => now });
const DURING_FOUNDERS = new Date("2026-11-02T09:00:00Z");
const AFTER_FOUNDERS = new Date("2027-03-01T09:00:00Z");

/** Azienda verificata con 3 offerte già chiuse (così la nuova si pubblica senza moderazione). */
async function company(registeredAt?: string) {
  const user = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ('company_member', $1, 'v1.finto', 1, now()) returning id`,
    [`test-bidx-${randomUUID()}`],
  );
  const userId = user.rows[0]!.id;
  created.users.push(userId);
  const c = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at, created_at)
     values ($1, 'AZIENDA FINTA SRL', 'Trattoria Finta', 'verified', now(), coalesce($2::timestamptz, now()))
     returning id`,
    [`8${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`, registeredAt ?? null],
  );
  const companyId = c.rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
    [companyId, userId],
  );
  const site = await pool.query<{ id: string }>(
    `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
     values ($1, '033032', 'Sede legale', true, now()) returning id`,
    [companyId],
  );
  for (let i = 0; i < 3; i++) {
    await pool.query(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code,
         contract_type, schedule, status, salary_min, salary_period)
       values ($1, 'Offerta chiusa', $2, 'Testo', '033032', 'permanent', 'full_time', 'closed', 1400, 'month')`,
      [companyId, occupationId],
    );
  }
  return { userId, companyId, siteId: site.rows[0]!.id };
}

const input = (companyId: string, place: string): OfferInput => ({
  companyId,
  siteId: OTHER_PLACE,
  place,
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
});

async function row(id: string) {
  const { rows } = await pool.query(
    `select status, scope, site_id, municipality_code from job_offers where id = $1`,
    [id],
  );
  return rows[0];
}

describe.skipIf(!DATABASE_URL)("zona gratuita e Piano Nazionale (WP-016)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
        ('015','Milano','MI','03'), ('098','Lodi','LO','03'), ('033','Piacenza','PC','08'),
        ('037','Bologna','BO','08') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
        ('015146','Milano','015','03',45.4642,9.1900), ('098031','Lodi','098','03',45.3097,9.5037),
        ('033032','Piacenza','033','08',45.0526,9.6934), ('037006','Bologna','037','08',44.4949,11.3426)
       on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(
      `insert into occupations (slug, category, label_it, isco_code, group_code)
       values ('test-zona', 'ristorazione', 'Cameriere di prova', '5131', '513')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
  });
  afterAll(async () => {
    await pool.query(`delete from entitlements where owner_id = any($1::uuid[])`, [
      created.companies,
    ]);
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    // Bologna serve solo qui: altri test contano tutti i comuni presenti nel DB.
    await pool.query(`delete from municipalities where istat_code = '037006'`);
    await pool.query(
      `delete from provinces p where p.code = '037'
         and not exists (select 1 from municipalities m where m.province_code = p.code)`,
    );
    await pool?.end();
  });

  it("in zona: stessa regione anche lontano (Bologna) o altra regione entro 50 km (Lodi) → locale, gratis", async () => {
    const c = await company("2027-01-10T10:00:00Z"); // non fondatrice: in zona non importa
    for (const place of ["Bologna", "lodi"]) {
      const r = await saveOffer(
        deps(AFTER_FOUNDERS),
        c.userId,
        input(c.companyId, place),
        "publish",
      );
      expect(r.status).toBe("saved");
      if (r.status !== "saved") continue;
      expect(r.offerStatus).toBe("published");
      expect((await row(r.offerId)).scope).toBe("local");
    }
  });

  it("fuori zona (Milano, ~60 km e altra regione): l'azienda fondatrice pubblica gratis come nazionale", async () => {
    const c = await company("2026-10-15T10:00:00Z"); // fondatrice
    const r = await saveOffer(
      deps(DURING_FOUNDERS),
      c.userId,
      input(c.companyId, "Milano"),
      "publish",
    );
    expect(r).toMatchObject({ status: "saved", offerStatus: "published" });
    if (r.status !== "saved") return;
    expect(await row(r.offerId)).toEqual({
      status: "published",
      scope: "national",
      site_id: null,
      municipality_code: "015146",
    });
    // Nella modifica il luogo torna come "altro comune" già scritto.
    const editable = await getOfferForMember(drizzle(pool), c.userId, r.offerId);
    expect(editable?.values).toMatchObject({ siteId: OTHER_PLACE, place: "Milano (MI)" });
  });

  it("fuori zona senza Piano Nazionale: resta bozza con il motivo; con il piano (anche promo) si pubblica", async () => {
    const c = await company("2027-01-10T10:00:00Z"); // registrata dopo il 31/12/2026
    const blocked = await saveOffer(
      deps(AFTER_FOUNDERS),
      c.userId,
      input(c.companyId, "Milano"),
      "publish",
    );
    expect(blocked.status).toBe("blocked");
    if (blocked.status !== "blocked") return;
    expect(blocked.issues).toContainEqual({
      code: "outside_free_zone",
      rule: "ADR-0009",
      severity: "error",
      field: "company",
    });
    expect((await row(blocked.offerId)).status).toBe("draft");

    // Anche un'azienda fondatrice, a periodo finito, torna alla sola zona gratuita.
    const founder = await company("2026-10-15T10:00:00Z");
    const later = await saveOffer(
      deps(AFTER_FOUNDERS),
      founder.userId,
      input(founder.companyId, "Milano"),
      "publish",
    );
    expect(later.status).toBe("blocked");

    await pool.query(
      `insert into entitlements (owner_type, owner_id, product, valid_from, valid_to, source)
       values ('company', $1, 'national', '2027-02-01T00:00:00Z', '2027-04-01T00:00:00Z', 'promo')`,
      [c.companyId],
    );
    const ok = await saveOffer(
      deps(AFTER_FOUNDERS),
      c.userId,
      input(c.companyId, "Milano"),
      "publish",
      blocked.offerId,
    );
    expect(ok).toMatchObject({ status: "saved", offerStatus: "published" });
    expect((await row(blocked.offerId)).scope).toBe("national");
  });

  it("comune scritto male: nessun salvataggio, suggerimenti; una bozza fuori zona si salva sempre", async () => {
    const c = await company("2027-01-10T10:00:00Z");
    const typo = await saveOffer(
      deps(AFTER_FOUNDERS),
      c.userId,
      input(c.companyId, "Milno"),
      "draft",
    );
    expect(typo.status).toBe("invalid_place");
    expect(typo.status === "invalid_place" && typo.options).toContain("Milano (MI)");

    const draft = await saveOffer(
      deps(AFTER_FOUNDERS),
      c.userId,
      input(c.companyId, "Milano"),
      "draft",
    );
    expect(draft).toMatchObject({ status: "saved", offerStatus: "draft" });
  });
});
