import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyDbRoles } from "@/lib/db/roles";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-027 (docs/04 §5 e §7): ruoli separati. NON modificarli per farli passare.

const suffix = randomUUID().slice(0, 8);
const names = { app: `hr_app_t${suffix}`, worker: `hr_worker_t${suffix}` };
let admin: Client;
let owner: string;
const tag = randomUUID();

/** Esegue `sql` come `role` e restituisce il codice d'errore Postgres (o null se riesce). */
async function as(role: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await admin.query("begin");
  try {
    await admin.query(`set local role ${admin.escapeIdentifier(role)}`);
    await admin.query(sql, params);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "errore";
  } finally {
    await admin.query("rollback");
  }
}

describe.skipIf(!DATABASE_URL)("ruoli del database (WP-027)", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: DATABASE_URL });
    await admin.connect();
    owner = (await admin.query<{ u: string }>("select current_user as u")).rows[0]!.u;
    await applyDbRoles(admin, { owner, ...names });
    await applyDbRoles(admin, { owner, ...names }); // idempotente
    await admin.query(
      `insert into audit_log (actor_id, action, target_id, at) values
         ('test', 'test.ruoli.vecchia', $1, now() - interval '13 months'),
         ('test', 'test.ruoli.recente', $1, now())`,
      [tag],
    );
  });
  afterAll(async () => {
    if (!admin) return;
    for (const role of [names.app, names.worker]) {
      await admin.query(`drop owned by ${admin.escapeIdentifier(role)} cascade`);
      await admin.query(`drop role if exists ${admin.escapeIdentifier(role)}`);
    }
    await admin.end();
  });

  it("app web: legge e scrive i dati, ma il log di audit solo in aggiunta", async () => {
    expect(await as(names.app, "select count(*) from users")).toBeNull();
    expect(
      await as(names.app, "update users set last_active_at = last_active_at where false"),
    ).toBeNull();
    expect(
      await as(
        names.app,
        `insert into audit_log (actor_id, action, at) values ('test', 'test.ruoli', now())`,
      ),
    ).toBeNull();
    expect(await as(names.app, "delete from audit_log where target_id = $1", [tag])).toBe("42501");
    expect(
      await as(names.app, "update audit_log set actor_id = 'x' where target_id = $1", [tag]),
    ).toBe("42501");
    expect(await as(names.app, "truncate users")).toBe("42501");
    expect(await as(names.app, "create table test_ruoli (id int)")).toBe("42501");
    expect(await as(names.app, "drop table waitlist")).toBe("42501");
  });

  it("worker: cancella solo il log oltre i 12 mesi", async () => {
    expect(
      await as(
        names.worker,
        "delete from audit_log where target_id = $1 and action = 'test.ruoli.vecchia'",
        [tag],
      ),
    ).toBeNull();
    expect(
      await as(
        names.worker,
        "delete from audit_log where target_id = $1 and action = 'test.ruoli.recente'",
        [tag],
      ),
    ).toBe("42501"); // il trigger lo vieta
    expect(await as(names.worker, "truncate audit_log")).toBe("42501");
  });

  it("pg-boss: il worker può eseguire la sua installazione, l'app web no", async () => {
    expect(await as(names.worker, "create schema if not exists pgboss")).toBeNull();
    expect(await as(names.app, "create schema if not exists pgboss")).toBe("42501");
    expect(await as(names.worker, "drop table users")).toBe("42501");
  });

  it("le tabelle create dalle migrazioni successive ricevono gli stessi permessi", async () => {
    const table = `test_ruoli_${suffix}`;
    await admin.query(`create table ${table} (id serial primary key, v text)`);
    try {
      expect(await as(names.app, `insert into ${table} (v) values ('x')`)).toBeNull();
    } finally {
      await admin.query(`drop table ${table}`);
    }
  });
});
