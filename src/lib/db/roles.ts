import type { Client } from "pg";

/**
 * Ruoli del database (WP-027, docs/04 §5 e §7). Si applicano al provisioning e dopo ogni migrazione (idempotente):
 * - `owner`: proprietario delle tabelle, usato SOLO dalla pipeline per le migrazioni;
 * - `app`: l'app web. Legge e scrive i dati, ma sul log di audit può solo aggiungere e leggere: niente UPDATE,
 *   DELETE, TRUNCATE (oltre al trigger della migrazione 0013). Niente DDL;
 * - `worker`: i job pianificati. Come `app`, più il DELETE su `audit_log` per la conservazione a 12 mesi (il
 *   trigger ammette solo le righe più vecchie), lo schema `pgboss` di cui è proprietario e il permesso di creare
 *   schemi (serve a pg-boss); le tabelle dell'app restano con gli stessi permessi di `app`.
 * Le password non passano da qui se non per impostarle: arrivano dall'ambiente del provisioning, mai dal repo.
 */

export type DbRoleNames = { owner: string; app: string; worker: string };
export type DbRolePasswords = { app?: string; worker?: string };

type Sql = Pick<Client, "query" | "escapeIdentifier" | "escapeLiteral">;

async function ensureRole(db: Sql, role: string, password: string | undefined): Promise<void> {
  const exists = await db.query("select 1 from pg_roles where rolname = $1", [role]);
  const login = password ? `login password ${db.escapeLiteral(password)}` : "nologin";
  await db.query(
    `${exists.rowCount ? "alter" : "create"} role ${db.escapeIdentifier(role)} ${login}`,
  );
}

export async function applyDbRoles(
  db: Sql,
  names: DbRoleNames,
  passwords: DbRolePasswords = {},
): Promise<void> {
  const [owner, app, worker] = [names.owner, names.app, names.worker].map((n) =>
    db.escapeIdentifier(n),
  );
  await ensureRole(db, names.app, passwords.app);
  await ensureRole(db, names.worker, passwords.worker);
  const { rows } = await db.query<{ db: string }>("select current_database() as db");
  const both = `${app}, ${worker}`;
  const statements = [
    `grant connect on database ${db.escapeIdentifier(rows[0]!.db)} to ${both}`,
    `grant usage on schema public to ${both}`,
    `revoke create on schema public from ${both}`,
    `grant select, insert, update, delete on all tables in schema public to ${both}`,
    `grant usage, select on all sequences in schema public to ${both}`,
    // Log di audit: solo aggiungere e leggere; il worker cancella (il trigger ammette solo oltre i 12 mesi).
    `revoke update, delete, truncate on audit_log from ${both}`,
    `grant delete on audit_log to ${worker}`,
    // Tabelle future create dalle migrazioni del proprietario.
    `alter default privileges for role ${owner} in schema public grant select, insert, update, delete on tables to ${both}`,
    `alter default privileges for role ${owner} in schema public grant usage, select on sequences to ${both}`,
    // pg-boss crea e aggiorna da sé le proprie tabelle nel suo schema. Esegue `CREATE SCHEMA IF NOT EXISTS`, e
    // Postgres chiede il permesso CREATE sul database anche se lo schema c'è già: solo al worker.
    `create schema if not exists pgboss authorization ${worker}`,
    `grant create on database ${db.escapeIdentifier(rows[0]!.db)} to ${worker}`,
  ];
  for (const sql of statements) await db.query(sql);
}
