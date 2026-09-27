/**
 * Genera le chiavi per la cifratura applicativa (ADR-0004):
 *   - KEK (Key Encryption Key): cifra le chiavi dei singoli utenti
 *   - chiave dell'indice cieco: permette di cercare le email senza salvarle in chiaro
 *
 * Uso:  pnpm keys:generate [--dir ./secrets] [--force]
 *
 * In PRODUZIONE: generare sul server, montare come Docker secret, e consegnare una copia cifrata
 * al custode delle chiavi (docs/04-PRIVACY-SICUREZZA.md §4). Perdere la KEK = perdere i dati.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dirIndex = args.indexOf("--dir");
const dir = resolve(dirIndex >= 0 && args[dirIndex + 1] ? args[dirIndex + 1]! : "./secrets");

const files = {
  kek: join(dir, "kek.b64"),
  blindIndex: join(dir, "blind-index.b64"),
};

for (const path of Object.values(files)) {
  if (existsSync(path) && !force) {
    console.error(
      `Esiste già ${path}. Non la sovrascrivo: sostituire una KEK rende illeggibili i dati.`,
    );
    console.error("Se sei sicuro (solo in sviluppo!), usa --force.");
    process.exit(1);
  }
}

mkdirSync(dir, { recursive: true, mode: 0o700 });
const header = `# Generata il ${new Date().toISOString()} — NON committare, NON condividere in chat o con le IA.\n`;
writeFileSync(files.kek, `${header}1:${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
writeFileSync(files.blindIndex, `${header}${randomBytes(32).toString("base64")}\n`, {
  mode: 0o600,
});

console.log("Chiavi generate:");
console.log(`  KEK_FILE=${files.kek}`);
console.log(`  BLIND_INDEX_KEY_FILE=${files.blindIndex}`);
console.log("");
console.log("Prossimi passi:");
console.log(
  "  1. Imposta le due variabili nel file .env.local (sviluppo) o come Docker secrets (produzione).",
);
console.log(
  "  2. PRODUZIONE: consegna una copia al custode delle chiavi (busta sigillata o quote Shamir).",
);
console.log(
  "  3. Rotazione della KEK: aggiungi una riga `2:<nuova chiave>` al file e riavvia; le righe vecchie restano.",
);
