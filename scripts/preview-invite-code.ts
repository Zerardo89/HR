/**
 * Genera un codice invito per i tester dell'anteprima (WP-010b), es. `K7QM-3ZTA-W9PR`.
 * 12 caratteri senza lettere ambigue (alfabeto dei codici di recupero): circa 60 bit, non si indovina.
 *
 * Uso:  pnpm preview:invite-code
 * Poi:  PREVIEW_INVITE_CODES=<codice> nella configurazione del server (più codici separati da virgole) e il codice
 *       nel messaggio di invito ai tester. Per bloccare le registrazioni basta togliere o cambiare il codice.
 */
import { randomInt } from "node:crypto";
import { parseInviteCodes, RECOVERY_ALPHABET } from "../src/modules/identity/domain";

const raw = Array.from(
  { length: 12 },
  () => RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)],
).join("");
const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
parseInviteCodes(code); // stesso controllo dell'avvio del server

console.log(code);
