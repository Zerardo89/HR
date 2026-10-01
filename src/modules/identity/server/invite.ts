import { hashToken, safeEqual } from "@/lib/tokens";
import { normalizeInviteCode } from "../domain";

/**
 * Codice invito dell'anteprima (WP-010b). Entrambi i lati si normalizzano (l'elenco può arrivare con trattini e
 * minuscole); si confrontano gli hash (stessa lunghezza) a tempo costante e si controllano tutti i codici: la
 * risposta non dice quanto il codice scritto era vicino a uno giusto.
 */
export function inviteCodeAccepted(input: string | undefined, codes: readonly string[]): boolean {
  if (!input) return false;
  const given = hashToken(normalizeInviteCode(input));
  let accepted = false;
  for (const code of codes) {
    if (safeEqual(given, hashToken(normalizeInviteCode(code)))) accepted = true;
  }
  return accepted;
}
