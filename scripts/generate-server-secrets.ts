/**
 * Crea le password del server (WP-010c) nella cartella dei segreti, senza mai sovrascrivere quelle che esistono:
 * cambiare una password del database dopo il primo avvio richiede una procedura (docs/runbook/SERVER-DI-CASA.md).
 *   - db_owner_password, db_app_password, db_worker_password: utenti del database (ADR-0014, WP-027)
 *   - restic_password: cifra i backup fuori sede. Senza questa password i backup sono illeggibili:
 *     va conservata anche fuori dal server (gestore di password del fondatore).
 * Le chiavi dei dati personali (KEK e indice cieco) le crea `pnpm keys:generate`.
 *
 * Uso:  pnpm secrets:generate [--dir ./secrets]
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const dirIndex = args.indexOf("--dir");
const dir = resolve(dirIndex >= 0 && args[dirIndex + 1] ? args[dirIndex + 1]! : "./secrets");

// Esadecimale: si può mettere così com'è nell'indirizzo del database (docker/entrypoint.sh).
const GENERATED = ["db_owner_password", "db_app_password", "db_worker_password", "restic_password"];
// Da incollare a mano dai servizi esterni (la guida dice dove prenderli).
const PASTED = ["cloudflared_token", "smtp_password", "r2_access_key_id", "r2_secret_access_key"];

mkdirSync(dir, { recursive: true, mode: 0o700 });

for (const name of GENERATED) {
  // "wx": il file si crea solo se non esiste, anche se due esecuzioni partono insieme.
  try {
    writeFileSync(join(dir, name), `${randomBytes(24).toString("hex")}\n`, {
      mode: 0o444,
      flag: "wx",
    });
    console.log(`  creata: ${name}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    console.log(`  già presente, non la tocco: ${name}`);
  }
}

const missing = [...PASTED, "kek.b64", "blind-index.b64"].filter((n) => !existsSync(join(dir, n)));
if (missing.length > 0) {
  console.log("");
  console.log("Mancano ancora (vedi docs/runbook/SERVER-DI-CASA.md):");
  for (const name of missing) console.log(`  - ${name}`);
}
