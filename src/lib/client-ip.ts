import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * IP del visitatore dall'intestazione configurata (`CLIENT_IP_HEADER`), usato SOLO in memoria per i limiti
 * di frequenza: non si salva e non si scrive nei log. `null` se manca (allora valgono solo gli altri limiti).
 */
export function clientIp(headers: Headers): string | null {
  const raw = headers.get(getServerEnv().CLIENT_IP_HEADER);
  const first = raw?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : null;
}
