/**
 * Assegna un ruolo a un utente GIÀ registrato (es. rendersi moderatore o admin). L'email non si salva e non si
 * stampa: si calcola l'indice cieco con la chiave dei file (`BLIND_INDEX_KEY_FILE`, `KEK_FILE`).
 * Uso: DATABASE_URL=… KEK_FILE=… BLIND_INDEX_KEY_FILE=… pnpm users:role <email | -> <worker|company_member|moderator|admin>
 * Con `-` l'email si scrive dopo l'avvio (sul server: non resta nella cronologia dei comandi).
 * Moderatori e admin dovranno attivare la verifica in due passaggi al primo accesso (ADR-0013).
 */
import { createInterface } from "node:readline/promises";
import { Pool } from "pg";
import { FileKeyProvider } from "../src/lib/crypto/key-provider";

const ROLES = ["worker", "company_member", "moderator", "admin"] as const;

/** Con `-` al posto dell'email la si scrive dopo l'avvio: così non resta nella cronologia dei comandi del server. */
async function readEmail(arg: string | undefined): Promise<string | undefined> {
  if (arg !== "-") return arg;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question("Email: ")).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const [emailArg, role] = process.argv.slice(2);
  const email = await readEmail(emailArg);
  const { DATABASE_URL, KEK_FILE, BLIND_INDEX_KEY_FILE } = process.env;
  if (!email || !role || !ROLES.includes(role as (typeof ROLES)[number])) {
    throw new Error(`Uso: pnpm users:role <email | -> <${ROLES.join("|")}>`);
  }
  if (!DATABASE_URL || !KEK_FILE || !BLIND_INDEX_KEY_FILE) {
    throw new Error("Servono DATABASE_URL, KEK_FILE e BLIND_INDEX_KEY_FILE.");
  }
  const keys = FileKeyProvider.fromFiles(KEK_FILE, BLIND_INDEX_KEY_FILE);
  const bidx = await keys.blindIndex(email, "email");
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    const { rows } = await pool.query<{ id: string }>(
      `update users set role = $1 where email_bidx = $2 returning id`,
      [role, bidx],
    );
    if (rows.length === 0)
      throw new Error("Nessun utente con questa email: registrati prima dal sito.");
    await pool.query(
      `insert into audit_log (actor_id, action, target_table, target_id, purpose) values ('system:script', 'user.role', 'users', $1, $2)`,
      [rows[0]!.id, role],
    );
    console.log(`Ruolo aggiornato: ${role} (utente ${rows[0]!.id}).`);
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error("Errore:", e.message);
  process.exitCode = 1;
});
