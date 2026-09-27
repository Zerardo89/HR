import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileKeyProvider } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { MAX_INVITES_PER_DAY, MAX_OPEN_INVITES } from "@/modules/companies/domain";
import {
  acceptInvite,
  createInvite,
  getInvite,
  listOpenInvites,
  revokeInvite,
  type InviteDeps,
} from "@/modules/companies/server/invites";
import {
  addSite,
  decideSite,
  listCompanySites,
  listPendingSites,
  removeSite,
} from "@/modules/companies/server/sites";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-011c (sedi operative e inviti ai colleghi) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);

let pool: Pool;
let clock = new Date("2026-10-05T09:00:00Z");
let sent: MailMessage[] = [];
let mailFails = false;
const created = { users: [] as string[], companies: [] as string[] };

const mailer: Mailer = {
  async send(message) {
    if (mailFails) throw new Error("smtp giù");
    sent.push(message);
  },
};

const deps = (): InviteDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "http://localhost:3000",
});

async function user(role: "company_member" | "moderator" | "worker", email?: string) {
  const bidx = email ? await keys.blindIndex(email, "email") : `test-bidx-${randomUUID()}`;
  const { rows } = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ($1, $2, 'v1.finto', 1, now()) returning id`,
    [role, bidx],
  );
  created.users.push(rows[0]!.id);
  return rows[0]!.id;
}

/** Azienda di prova con sede legale a Piacenza e titolare `owner`. */
async function company(owner: string) {
  const vat = `3${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`;
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Trattoria Finta', 'verified', now()) returning id`,
    [vat],
  );
  const id = rows[0]!.id;
  created.companies.push(id);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner')`,
    [id, owner],
  );
  await pool.query(
    `insert into company_sites (company_id, municipality_code, label, is_legal_seat, approved_at)
     values ($1, '033032', 'Sede legale', true, now())`,
    [id],
  );
  return id;
}

const tokenFromLastEmail = () => {
  const m = /\/invito\/([A-Za-z0-9_-]{43})/.exec(sent.at(-1)?.text ?? "");
  if (!m) throw new Error("nessun link di invito nell'ultima email");
  return m[1]!;
};

describe.skipIf(!DATABASE_URL)("sedi operative e inviti (WP-011c)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
        ('015','Milano','MI','03'), ('098','Lodi','LO','03'), ('033','Piacenza','PC','08') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
        ('015146','Milano','015','03',45.4642,9.1900), ('098031','Lodi','098','03',45.3097,9.5037),
        ('033032','Piacenza','033','08',45.0526,9.6934) on conflict do nothing`,
    );
  });
  beforeEach(() => {
    sent = [];
    mailFails = false;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("sede operativa: solo il titolare, in attesa finché il moderatore non la approva", async () => {
    const owner = await user("company_member");
    const companyId = await company(owner);
    const recruiter = await user("company_member");
    await pool.query(
      `insert into company_members (company_id, user_id, role) values ($1, $2, 'recruiter')`,
      [companyId, recruiter],
    );
    const input = { companyId, label: "Punto vendita centro", place: "lodi" };

    expect(await addSite(deps(), recruiter, input)).toEqual({ status: "not_allowed" });
    const added = await addSite(deps(), owner, input);
    expect(added.status).toBe("added");
    expect(await addSite(deps(), owner, { ...input, label: "punto vendita  CENTRO" })).toEqual({
      status: "duplicate",
    });
    const typo = await addSite(deps(), owner, { ...input, place: "Lodii" });
    expect(typo.status).toBe("place_not_found");

    const sites = await listCompanySites(drizzle(pool), recruiter, companyId);
    expect(sites?.map((s) => [s.label, s.municipality, s.state])).toEqual([
      ["Sede legale", "Piacenza", "approved"],
      ["Punto vendita centro", "Lodi", "pending"],
    ]);
    expect(
      await listCompanySites(drizzle(pool), await user("company_member"), companyId),
    ).toBeNull();

    // Nel pannello: distanza dalla sede legale (Piacenza–Lodi ≈ 29 km) e regione diversa.
    const pending = (await listPendingSites(drizzle(pool))).find((p) => p.companyId === companyId);
    expect(pending).toMatchObject({
      label: "Punto vendita centro",
      municipality: "Lodi",
      legalSeat: "Piacenza",
      sameRegionAsLegalSeat: false,
    });
    expect(pending!.distanceFromLegalSeatKm).toBeGreaterThan(25);
    expect(pending!.distanceFromLegalSeatKm).toBeLessThan(35);

    const siteId = added.status === "added" ? added.siteId : "";
    expect(await decideSite(deps(), owner, { decision: "approve", siteId })).toEqual({
      status: "not_allowed",
    });
    const moderator = await user("moderator");
    expect(await decideSite(deps(), moderator, { decision: "approve", siteId })).toEqual({
      status: "approved",
    });
    expect(await decideSite(deps(), moderator, { decision: "approve", siteId })).toEqual({
      status: "not_found",
    });
    const audit = await pool.query(
      `select action, purpose from audit_log where actor_id = $1 and target_id = $2`,
      [moderator, siteId],
    );
    expect(audit.rows).toEqual([{ action: "company.site", purpose: "approve" }]);
  });

  it("sede rifiutata: l'azienda vede il motivo; il titolare può toglierla, mai la sede legale", async () => {
    const owner = await user("company_member");
    const companyId = await company(owner);
    const added = await addSite(deps(), owner, { companyId, label: "Magazzino", place: "Milano" });
    const siteId = added.status === "added" ? added.siteId : "";
    const moderator = await user("moderator");
    expect(
      await decideSite(deps(), moderator, { decision: "reject", siteId, reason: "not_found" }),
    ).toEqual({ status: "rejected" });
    const sites = await listCompanySites(drizzle(pool), owner, companyId);
    expect(sites?.find((s) => s.id === siteId)).toMatchObject({
      state: "rejected",
      rejectionReason: "not_found",
    });

    const legal = sites!.find((s) => s.isLegalSeat)!;
    expect(await removeSite(deps(), owner, legal.id)).toEqual({ status: "not_allowed" });
    expect(await removeSite(deps(), await user("company_member"), siteId)).toEqual({
      status: "not_allowed",
    });
    expect(await removeSite(deps(), owner, siteId)).toEqual({ status: "removed" });
  });

  it("invito: email con link, nel DB solo indice cieco e hash del token; accetta solo l'account giusto", async () => {
    const owner = await user("company_member");
    const companyId = await company(owner);
    const email = `collega.finta+${randomUUID().slice(0, 8)}@esempio.it`;

    const recruiterCandidate = await user("company_member");
    expect(await createInvite(deps(), recruiterCandidate, { companyId, email })).toEqual({
      status: "not_allowed",
    });
    expect(await createInvite(deps(), owner, { companyId, email })).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(email);
    expect(sent[0]!.subject).toContain("Trattoria Finta");
    const token = tokenFromLastEmail();

    const { rows } = await pool.query(`select * from company_invites where company_id = $1`, [
      companyId,
    ]);
    expect(rows).toHaveLength(1);
    const stored = JSON.stringify(rows[0]);
    expect(stored).not.toContain(email);
    expect(stored).not.toContain(token);
    expect(rows[0].email_bidx).toBe(await keys.blindIndex(email, "email"));

    expect(await getInvite(deps(), token)).toEqual({
      status: "open",
      companyName: "Trattoria Finta",
    });
    const open = await listOpenInvites(deps(), owner, companyId);
    expect(open?.map((i) => i.state)).toEqual(["open"]);
    expect(await listOpenInvites(deps(), recruiterCandidate, companyId)).toBeNull();

    // Link inoltrato: un altro account azienda non entra; un lavoratore neppure.
    expect(await acceptInvite(deps(), recruiterCandidate, token)).toEqual({
      status: "wrong_account",
    });
    const workerSameEmail = await user("worker");
    expect(await acceptInvite(deps(), workerSameEmail, token)).toEqual({
      status: "not_company_account",
    });

    const invitee = await user("company_member", email);
    expect(await acceptInvite(deps(), invitee, token)).toEqual({ status: "accepted", companyId });
    const member = await pool.query(
      `select role from company_members where company_id = $1 and user_id = $2`,
      [companyId, invitee],
    );
    expect(member.rows).toEqual([{ role: "recruiter" }]);
    expect(await acceptInvite(deps(), invitee, token)).toEqual({ status: "used" });
    expect(await getInvite(deps(), token)).toEqual({ status: "used" });

    // Un collega che è già dentro non si reinvita.
    expect(await createInvite(deps(), owner, { companyId, email })).toEqual({
      status: "already_member",
    });
  });

  it("scadenza a 7 giorni, nuovo invito che sostituisce il vecchio, revoca, limite e invio fallito", async () => {
    const owner = await user("company_member");
    const companyId = await company(owner);
    const email = `collega.finta+${randomUUID().slice(0, 8)}@esempio.it`;

    await createInvite(deps(), owner, { companyId, email });
    const first = tokenFromLastEmail();
    await createInvite(deps(), owner, { companyId, email });
    const second = tokenFromLastEmail();
    expect(await getInvite(deps(), first)).toEqual({ status: "used" });
    expect((await listOpenInvites(deps(), owner, companyId))?.length).toBe(1);

    const saved = clock;
    clock = new Date(clock.getTime() + 7 * 24 * 60 * 60_000 + 1000);
    expect(await getInvite(deps(), second)).toEqual({ status: "expired" });
    const invitee = await user("company_member", email);
    expect(await acceptInvite(deps(), invitee, second)).toEqual({ status: "expired" });
    clock = saved;

    const [row] = (await listOpenInvites(deps(), owner, companyId)) ?? [];
    expect(await revokeInvite(deps(), await user("company_member"), row!.id)).toEqual({
      status: "not_allowed",
    });
    expect(await revokeInvite(deps(), owner, row!.id)).toEqual({ status: "revoked" });
    expect(await getInvite(deps(), second)).toEqual({ status: "used" });

    for (let i = 0; i < MAX_OPEN_INVITES; i++) {
      expect(
        await createInvite(deps(), owner, {
          companyId,
          email: `altro.finto+${i}-${randomUUID().slice(0, 6)}@esempio.it`,
        }),
      ).toEqual({ status: "sent" });
    }
    expect(
      await createInvite(deps(), owner, { companyId, email: "troppi.finto@esempio.it" }),
    ).toEqual({ status: "too_many" });

    const other = await company(await user("company_member"));
    const ownerOfOther = (
      await pool.query<{ user_id: string }>(
        `select user_id from company_members where company_id = $1`,
        [other],
      )
    ).rows[0]!.user_id;
    mailFails = true;
    expect(await createInvite(deps(), ownerOfOther, { companyId: other, email })).toEqual({
      status: "send_failed",
    });
    expect(await listOpenInvites(deps(), ownerOfOther, other)).toEqual([]);
    expect(await getInvite(deps(), "non-un-token")).toEqual({ status: "not_found" });
  });

  it("inviti solo da aziende verificate e al massimo 20 al giorno (le email partono a nome nostro)", async () => {
    const owner = await user("company_member");
    const companyId = await company(owner);
    await pool.query(`update companies set status = 'pending' where id = $1`, [companyId]);
    expect(
      await createInvite(deps(), owner, { companyId, email: "attesa.finto@esempio.it" }),
    ).toEqual({ status: "company_not_verified" });
    expect(sent).toHaveLength(0);

    await pool.query(`update companies set status = 'verified' where id = $1`, [companyId]);
    for (let i = 0; i < MAX_INVITES_PER_DAY; i++) {
      expect(
        await createInvite(deps(), owner, { companyId, email: `giro.finto+${i}@esempio.it` }),
      ).toEqual({ status: "sent" });
      const [open] = (await listOpenInvites(deps(), owner, companyId)) ?? [];
      await revokeInvite(deps(), owner, open!.id); // revocare non azzera il conteggio
    }
    expect(
      await createInvite(deps(), owner, { companyId, email: "giro.finto+extra@esempio.it" }),
    ).toEqual({ status: "too_many" });
    const saved = clock;
    clock = new Date(clock.getTime() + 24 * 60 * 60_000 + 1000);
    expect(
      await createInvite(deps(), owner, { companyId, email: "giro.finto+domani@esempio.it" }),
    ).toEqual({ status: "sent" });
    clock = saved;
  });
});
