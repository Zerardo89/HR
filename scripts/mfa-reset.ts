/**
 * Azzera la 2FA di un utente che ha perso telefono e codici di recupero (WP-011b).
 * Uso: DATABASE_URL=… KEK_FILE=… BLIND_INDEX_KEY_FILE=… pnpm mfa:reset <email>
 * Prima verifica l'identità di chi chiede (per esempio dalla PEC dell'azienda): chi ha accesso alla sua
 * email potrà riattivare la 2FA con un telefono nuovo.
 */
import { Pool } from "pg";
import { FileKeyProvider } from "../src/lib/crypto/key-provider";
import { resetSecondFactor } from "../src/modules/identity/server/mfa-reset";

async function main() {
  const url = process.env.DATABASE_URL;
  const kek = process.env.KEK_FILE ?? "./secrets/kek.b64";
  const indexKey = process.env.BLIND_INDEX_KEY_FILE ?? "./secrets/blind-index.b64";
  const email = process.argv[2];
  if (!url) throw new Error("DATABASE_URL mancante.");
  if (!email) throw new Error("Uso: pnpm mfa:reset <email>");

  const bidx = await FileKeyProvider.fromFiles(kek, indexKey).blindIndex(email, "email");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const { rows } = await pool.query<{ id: string }>(
      `select id from users where email_bidx = $1`,
      [bidx],
    );
    const userId = rows[0]?.id;
    // Solo l'id nei messaggi: l'email non finisce nei log del terminale.
    if (!userId || !(await resetSecondFactor(pool, userId, new Date()))) {
      console.error("Nessun utente con questa email.");
      process.exitCode = 1;
      return;
    }
    console.log(`2FA azzerata per l'utente ${userId}; sessioni chiuse.`);
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error("Azzeramento fallito:", e.message);
  process.exitCode = 1;
});
