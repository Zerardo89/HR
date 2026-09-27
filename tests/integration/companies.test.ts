import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ViesResult } from "@/modules/companies/domain";
import type { ViesClient } from "@/modules/companies/server/deps";
import { getCompaniesForUser } from "@/modules/companies/server/queries";
import { registerCompany } from "@/modules/companies/server/register";
import { createViesClient } from "@/modules/companies/server/vies-client";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-011 (registrazione aziende) sul DB reale. NON modificarli per farli passare.

// P.IVA sintetiche con cifra di controllo corretta (nessuna azienda reale coinvolta: VIES è finto).
const VATS = ["11111111115", "22222222220", "33333333335", "44444444440"];

let pool: Pool;
const users: string[] = [];
const now = () => new Date("2026-10-05T08:00:00Z");

const fakeVies = (result: ViesResult): ViesClient & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async check(vat) {
      calls.push(vat);
      return result;
    },
  };
};
const validVies = fakeVies({
  status: "valid",
  name: "AZIENDA FINTA SRL",
  address: "VIA ROMA 1\n20121 MILANO MI",
});
const deps = (vies: ViesClient = validVies) => ({ db: drizzle(pool), now, vies });

async function newUser(role: "company_member" | "worker" = "company_member"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ($1, $2, 'v1.finto', 1, now()) returning id`,
    [role, `test-bidx-${randomUUID()}`],
  );
  users.push(rows[0]!.id);
  return rows[0]!.id;
}

const input = (vat: string, over: object = {}) => ({
  vat,
  displayName: "Trattoria Finta",
  kind: "employer" as const,
  agencyAuthorization: undefined,
  ...over,
});

describe.skipIf(!DATABASE_URL)("registrazione aziende (WP-011)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    // Dati di riferimento sintetici con codici ISTAT reali (Milano), se mancano.
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
  });
  afterEach(async () => {
    await pool.query(`delete from companies where vat_number = any($1)`, [VATS]);
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [users]);
    await pool?.end();
  });

  it("P.IVA valida su VIES → azienda verificata, ragione sociale da VIES, titolare, sede legale approvata", async () => {
    const userId = await newUser();
    const result = await registerCompany(deps(), userId, input(VATS[0]!));
    expect(result).toMatchObject({ status: "created", verified: true });

    const [company] = await getCompaniesForUser(drizzle(pool), userId);
    expect(company).toMatchObject({
      displayName: "Trattoria Finta",
      legalName: "AZIENDA FINTA SRL",
      vatNumber: VATS[0],
      status: "verified",
      role: "owner",
      legalSeat: "Milano",
    });
    const { rows } = await pool.query(
      `select is_legal_seat, approved_at is not null as approved from company_sites s
       join companies c on c.id = s.company_id where c.vat_number = $1`,
      [VATS[0]],
    );
    expect(rows).toEqual([{ is_legal_seat: true, approved: true }]);
  });

  it("P.IVA non attiva su VIES → nessuna azienda creata", async () => {
    const userId = await newUser();
    expect(
      await registerCompany(deps(fakeVies({ status: "invalid" })), userId, input(VATS[1]!)),
    ).toEqual({
      status: "vat_invalid",
    });
    expect(await getCompaniesForUser(drizzle(pool), userId)).toEqual([]);
  });

  it("VIES non raggiungibile → azienda creata 'in verifica', senza sede legale", async () => {
    const userId = await newUser();
    const result = await registerCompany(
      deps(fakeVies({ status: "unavailable" })),
      userId,
      input(VATS[1]!),
    );
    expect(result).toMatchObject({ status: "created", verified: false });
    const [company] = await getCompaniesForUser(drizzle(pool), userId);
    expect(company).toMatchObject({
      status: "pending",
      legalName: "Trattoria Finta",
      legalSeat: null,
    });
  });

  it("un'agenzia resta in verifica anche con VIES valido (autorizzazione controllata a mano, R-LAV-03)", async () => {
    const userId = await newUser();
    const result = await registerCompany(
      deps(),
      userId,
      input(VATS[2]!, { kind: "agency", agencyAuthorization: "Prot. 00/0000" }),
    );
    expect(result).toMatchObject({ status: "created", verified: false });
    const [company] = await getCompaniesForUser(drizzle(pool), userId);
    expect(company).toMatchObject({ kind: "agency", status: "pending" });
  });

  it("una P.IVA già registrata non si registra di nuovo (e VIES non viene nemmeno chiamato)", async () => {
    await registerCompany(deps(), await newUser(), input(VATS[3]!));
    const vies = fakeVies({ status: "valid", name: "ALTRA", address: null });
    const intruder = await newUser();
    expect(await registerCompany(deps(vies), intruder, input(VATS[3]!))).toEqual({
      status: "already_registered",
    });
    expect(vies.calls).toEqual([]);
    expect(await getCompaniesForUser(drizzle(pool), intruder)).toEqual([]);
  });

  it("solo gli utenti con ruolo azienda possono registrare un'azienda", async () => {
    const worker = await newUser("worker");
    expect(await registerCompany(deps(), worker, input(VATS[0]!))).toEqual({
      status: "not_allowed",
    });
  });

  it("il client VIES trasforma ogni guasto in 'unavailable' (mai un rifiuto)", async () => {
    const down = createViesClient("http://127.0.0.1:9", fetch, 500);
    expect(await down.check(VATS[0]!)).toEqual({ status: "unavailable" });
    const html = createViesClient(
      "http://vies.invalid",
      async () => new Response("<html/>", { status: 200 }),
    );
    expect(await html.check(VATS[0]!)).toEqual({ status: "unavailable" });
    const ok = createViesClient("http://vies.invalid/", async (url) => {
      expect(String(url)).toBe(`http://vies.invalid/ms/IT/vat/${VATS[0]}`);
      return Response.json({ isValid: true, name: "AZIENDA FINTA SRL", address: "---" });
    });
    expect(await ok.check(VATS[0]!)).toEqual({
      status: "valid",
      name: "AZIENDA FINTA SRL",
      address: null,
    });
  });
});
