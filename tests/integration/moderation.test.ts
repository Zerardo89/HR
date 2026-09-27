import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyCompanyManually } from "@/modules/companies/server/verification";
import { decideOffer, listPendingOffers } from "@/modules/offers/server/moderation";
import { getOfferForMember } from "@/modules/offers/server/queries";
import { saveOffer } from "@/modules/offers/server/save-offer";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-013b (moderazione) sul DB reale. NON modificarli per farli passare.

let pool: Pool;
let occupationId: number;
let clock = new Date("2026-11-02T09:00:00Z");
const deps = () => ({ db: drizzle(pool), now: () => clock });
const created = { users: [] as string[], companies: [] as string[] };

async function user(role: "company_member" | "moderator" | "worker") {
  const { rows } = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ($1, $2, 'v1.finto', 1, now()) returning id`,
    [role, `test-bidx-${randomUUID()}`],
  );
  created.users.push(rows[0]!.id);
  return rows[0]!.id;
}

async function company(status: "verified" | "pending", ownerId: string) {
  const vat = `7${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`;
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status) values ($1, 'FINTA SRL', 'Finta', $2) returning id`,
    [vat, status],
  );
  const id = rows[0]!.id;
  created.companies.push(id);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
    [id, ownerId],
  );
  const site = await pool.query<{ id: string }>(
    `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
     values ($1, '015146', 'Sede legale', true, now()) returning id`,
    [id],
  );
  return { id, siteId: site.rows[0]!.id };
}

async function pendingOffer(validDays = 20) {
  const owner = await user("company_member");
  const c = await company("verified", owner);
  const result = await saveOffer(
    deps(),
    owner,
    {
      companyId: c.id,
      siteId: c.siteId,
      occupationId,
      title: "Cameriere/a di sala",
      description:
        "Servizio ai tavoli, pranzo e cena, cinque giorni su sette, con esperienza di almeno un anno.",
      contractType: "permanent",
      schedule: "full_time",
      salaryMin: 1400,
      salaryPeriod: "month",
      salaryBasis: "gross",
      ccnl: "Turismo",
      validDays,
      internshipDeclaration: false,
    },
    "publish",
  );
  if (result.status !== "saved" || result.offerStatus !== "pending_review")
    throw new Error("attesa moderazione");
  return { owner, companyId: c.id, offerId: result.offerId };
}

describe.skipIf(!DATABASE_URL)("moderazione (WP-013b)", () => {
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
       values ('test-moderazione', 'ristorazione', 'Cameriere di prova', '5131', '513')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("approvazione: pubblicata ora, con i giorni chiesti dall'azienda; resta nel log di audit", async () => {
    const { offerId } = await pendingOffer(20);
    expect((await listPendingOffers(drizzle(pool))).map((o) => o.id)).toContain(offerId);
    const moderator = await user("moderator");
    clock = new Date("2026-11-03T10:00:00Z");
    expect(await decideOffer(deps(), moderator, { decision: "approve", offerId })).toEqual({
      status: "approved",
    });

    const { rows } = await pool.query(
      `select status, published_at, valid_through from job_offers where id = $1`,
      [offerId],
    );
    expect(rows[0]).toEqual({
      status: "published",
      published_at: clock,
      valid_through: new Date(clock.getTime() + 20 * 24 * 60 * 60_000),
    });
    const audit = await pool.query(
      `select action, purpose from audit_log where actor_id = $1 and target_id = $2`,
      [moderator, offerId],
    );
    expect(audit.rows).toEqual([{ action: "offer.moderate", purpose: "approve" }]);
    // Già decisa: una seconda decisione non trova più l'offerta.
    expect(await decideOffer(deps(), moderator, { decision: "approve", offerId })).toEqual({
      status: "not_found",
    });
  });

  it("rifiuto: torna bozza e l'azienda vede motivo e nota (DSA art. 17)", async () => {
    const { owner, offerId } = await pendingOffer();
    const moderator = await user("moderator");
    expect(
      await decideOffer(deps(), moderator, {
        decision: "reject",
        offerId,
        reason: "salary",
        note: "Lo stipendio indicato è sotto il minimo del contratto collettivo.",
      }),
    ).toEqual({ status: "rejected" });
    const offer = await getOfferForMember(drizzle(pool), owner, offerId);
    expect(offer?.status).toBe("draft");
    expect(offer?.rejection).toEqual({
      reason: "salary",
      note: "Lo stipendio indicato è sotto il minimo del contratto collettivo.",
    });
  });

  it("solo moderatori e admin; un'azienda non più verificata non si approva", async () => {
    const { offerId, companyId } = await pendingOffer();
    const worker = await user("worker");
    expect(await decideOffer(deps(), worker, { decision: "approve", offerId })).toEqual({
      status: "not_allowed",
    });
    await pool.query(`update companies set status = 'suspended' where id = $1`, [companyId]);
    const moderator = await user("moderator");
    expect(await decideOffer(deps(), moderator, { decision: "approve", offerId })).toEqual({
      status: "company_not_verified",
    });
  });

  it("verifica manuale di un'azienda in attesa, registrata nel log di audit", async () => {
    const owner = await user("company_member");
    const c = await company("pending", owner);
    const worker = await user("worker");
    expect(await verifyCompanyManually(deps(), worker, c.id)).toEqual({ status: "not_allowed" });
    const moderator = await user("moderator");
    expect(await verifyCompanyManually(deps(), moderator, c.id)).toEqual({ status: "verified" });
    const { rows } = await pool.query(`select status, verification from companies where id = $1`, [
      c.id,
    ]);
    expect(rows[0].status).toBe("verified");
    expect(rows[0].verification).toMatchObject({ method: "manual", by: moderator });
    expect(await verifyCompanyManually(deps(), moderator, c.id)).toEqual({ status: "not_found" });
  });
});
