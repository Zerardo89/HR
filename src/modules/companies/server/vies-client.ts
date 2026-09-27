import { logger } from "@/lib/logger";
import { parseViesResponse } from "../domain";
import type { ViesClient } from "./deps";

/**
 * Client REST di VIES (GET {base}/ms/IT/vat/{numero}). Nessun dato personale in uscita: solo la P.IVA.
 * Qualsiasi guasto (rete, timeout, risposta strana) = "unavailable": l'azienda resta in verifica, non viene rifiutata.
 */
export function createViesClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): ViesClient {
  return {
    async check(vat) {
      try {
        const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/ms/IT/vat/${vat}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return { status: "unavailable" };
        return parseViesResponse(await res.json());
      } catch (error) {
        logger.warn({ err: (error as Error).name }, "VIES non raggiungibile");
        return { status: "unavailable" };
      }
    },
  };
}
