import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dekContextFor, FileKeyProvider, newDataKey } from "@/lib/crypto";
import { readWorkerPii } from "@/modules/privacy/server/worker-pii";
import type { WorkerProfileInput } from "@/modules/profiles/domain";
import {
  getOwnWorkerProfile,
  saveWorkerProfile,
  setWorkerState,
} from "@/modules/profiles/server/profile";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-017 (profilo del lavoratore, dati C2 cifrati) sul DB reale. NON modificarli.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
let pool: Pool;
let occupationIds: number[];
const now = new Date("2026-11-03T10:00:00Z");
const deps = () => ({ db: drizzle(pool), keys, now: () => now });
const created: string[] = [];

/** Utente di prova con la sua DEK (come alla registrazione). */
async function user(role: "worker" | "company_member" = "worker") {
  const id = randomUUID();
  const { dekWrapped, keyVersion, dek } = await newDataKey(keys, dekContextFor("users", id));
  dek.fill(0);
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at)
     values ($1, $2, $3, 'v1.finto', $4, $5, now())`,
    [id, role, `test-bidx-${randomUUID()}`, dekWrapped, keyVersion],
  );
  created.push(id);
  return id;
}

const input = (over: Partial<WorkerProfileInput> = {}): WorkerProfileInput => ({
  occupationIds,
  place: "Lodi",
  radiusKm: 20,
  relocationRegionCodes: ["08"],
  experienceBand: "y1_3",
  availableFrom: "2026-11-15",
  contractPrefs: ["permanent", "seasonal"],
  schedulePrefs: ["full_time"],
  drivingLicenses: ["B"],
  languages: [
    { code: "it", level: "native" },
    { code: "en", level: "b1" },
  ],
  state: "seeking",
  monthlyCheckOptIn: false,
  pii: {
    firstName: "Mariolina",
    lastName: "Rossifinta",
    phone: "+39 333 123 4567",
    about: "Lavoro in sala da tre anni.",
    experiences: [{ role: "Cameriera", employer: "Trattoria Esempiofinto", period: "2022-2025" }],
    education: [{ title: "Diploma alberghiero", school: "Istituto Esempiofinto", year: "2021" }],
  },
  ...over,
});

describe.skipIf(!DATABASE_URL)("profilo del lavoratore (WP-017)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('098','Lodi','LO','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('098031','Lodi','098','03',45.3097,9.5037) on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(
      `insert into occupations (slug, category, label_it, group_code) values
         ('test-profilo-a', 'ristorazione', 'Cameriere di prova', '999'),
         ('test-profilo-b', 'ristorazione', 'Barista di prova', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationIds = occ.rows.map((r) => r.id);
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [created]);
    await pool?.end();
  });

  it("salva: ricerca in chiaro, dati identificativi SOLO cifrati; il lavoratore li rilegge (con audit)", async () => {
    const id = await user();
    expect(await saveWorkerProfile(deps(), id, input())).toEqual({ status: "saved" });

    const { rows } = await pool.query(`select * from worker_profiles where user_id = $1`, [id]);
    const row = rows[0];
    expect(row).toMatchObject({
      state: "seeking",
      municipality_code: "098031",
      radius_km: 20,
      experience_band: "y1_3",
    });
    const stored = JSON.stringify(row);
    for (const secret of ["Mariolina", "Rossifinta", "333 123", "Esempiofinto", "tre anni"]) {
      expect(stored).not.toContain(secret);
    }
    expect(String(row.pii_enc)).toMatch(/^v1\./);
    const langs = await pool.query(
      `select language_code, level from profile_languages where user_id = $1 order by language_code`,
      [id],
    );
    expect(langs.rows).toEqual([
      { language_code: "en", level: "b1" },
      { language_code: "it", level: "native" },
    ]);

    const view = await getOwnWorkerProfile(deps(), id);
    expect(view).toMatchObject({
      place: "Lodi (LO)",
      relocationRegionCodes: ["08"],
      pii: { firstName: "Mariolina", lastName: "Rossifinta", phone: "+39 333 123 4567" },
    });
    expect(view?.occupations.map((o) => o.id).sort()).toEqual([...occupationIds].sort());
    const audit = await pool.query(
      `select actor_id, action, target_table, purpose from audit_log where target_id = $1`,
      [id],
    );
    expect(audit.rows).toEqual([
      {
        actor_id: id,
        action: "pii.decrypt",
        target_table: "worker_profiles",
        purpose: "worker.self-view",
      },
    ]);
  });

  it("nessun altro legge i dati cifrati; solo i lavoratori hanno un profilo", async () => {
    const worker = await user();
    await saveWorkerProfile(deps(), worker, input());
    const other = await user();
    await expect(
      readWorkerPii(deps(), worker, { purpose: "worker.self-view", actorId: other }),
    ).rejects.toThrow();
    const company = await user("company_member");
    expect(await saveWorkerProfile(deps(), company, input())).toEqual({ status: "not_allowed" });
  });

  it("un testo cifrato copiato su un altro utente non si decifra (legato a riga e chiave)", async () => {
    const a = await user();
    const b = await user();
    await saveWorkerProfile(deps(), a, input());
    await saveWorkerProfile(
      deps(),
      b,
      input({ pii: { ...input().pii, firstName: "Altro", lastName: "Finto" } }),
    );
    await pool.query(
      `update worker_profiles set pii_enc = (select pii_enc from worker_profiles where user_id = $1)
       where user_id = $2`,
      [a, b],
    );
    await expect(getOwnWorkerProfile(deps(), b)).rejects.toThrow();
  });

  it("chiave distrutta (cancellazione, crypto-shredding): i dati identificativi non si leggono più", async () => {
    const id = await user();
    await saveWorkerProfile(deps(), id, input());
    await pool.query(`update users set dek_wrapped = null where id = $1`, [id]);
    const view = await getOwnWorkerProfile(deps(), id);
    expect(view?.pii).toBeNull();
    expect(view?.place).toBe("Lodi (LO)"); // i dati di ricerca restano finché la cancellazione non li toglie
  });

  it("comune sbagliato, mansione inesistente, stato e mail mensile", async () => {
    const id = await user();
    const typo = await saveWorkerProfile(deps(), id, input({ place: "Lodii" }));
    expect(typo.status).toBe("invalid_place");
    expect(typo.status === "invalid_place" && typo.options).toContain("Lodi (LO)");
    expect(await saveWorkerProfile(deps(), id, input({ occupationIds: [999_999] }))).toEqual({
      status: "invalid_occupation",
    });

    expect(await setWorkerState(deps(), id, "open")).toEqual({ status: "no_profile" });
    await saveWorkerProfile(deps(), id, input({ monthlyCheckOptIn: true, state: "open" }));
    const first = await pool.query(`select next_check_at from worker_profiles where user_id = $1`, [
      id,
    ]);
    expect(first.rows[0].next_check_at).toEqual(new Date("2026-12-03T10:00:00Z"));
    expect(await setWorkerState(deps(), id, "hidden")).toEqual({ status: "updated" });
    await saveWorkerProfile(deps(), id, input({ monthlyCheckOptIn: false, state: "hidden" }));
    const off = await pool.query(
      `select state, next_check_at from worker_profiles where user_id = $1`,
      [id],
    );
    expect(off.rows[0]).toEqual({ state: "hidden", next_check_at: null });
  });
});
