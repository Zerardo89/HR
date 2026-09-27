import { z } from "zod";

/**
 * Risposta del servizio VIES della Commissione europea (REST: GET /ms/IT/vat/{numero}).
 * Il servizio è spesso irraggiungibile ("MS_UNAVAILABLE"): in quel caso l'azienda resta "in verifica",
 * non viene rifiutata.
 */
export type ViesResult =
  | { status: "valid"; name: string | null; address: string | null }
  | { status: "invalid" }
  | { status: "unavailable" };

const response = z.object({
  isValid: z.boolean(),
  userError: z.string().optional(),
  name: z.string().nullish(),
  address: z.string().nullish(),
});

/** Errori di VIES che significano "numero non valido"; tutti gli altri sono guasti temporanei. */
const INVALID_ERRORS = new Set(["INVALID", "INVALID_INPUT", "VALID"]);

function clean(value: string | null | undefined): string | null {
  const v = value?.replace(/\s+\n/g, "\n").trim();
  return v && v !== "---" && v !== "N/A" ? v : null;
}

export function parseViesResponse(body: unknown): ViesResult {
  const parsed = response.safeParse(body);
  if (!parsed.success) return { status: "unavailable" };
  const r = parsed.data;
  if (r.isValid) return { status: "valid", name: clean(r.name), address: clean(r.address) };
  return INVALID_ERRORS.has(r.userError ?? "INVALID")
    ? { status: "invalid" }
    : { status: "unavailable" };
}

export type ViesAddress = { cap: string; city: string; provinceAbbr: string };

/** L'ultima riga di un indirizzo italiano in VIES è "CAP COMUNE SIGLA" (es. "20121 MILANO MI"). */
export function parseViesAddress(address: string | null): ViesAddress | null {
  if (!address) return null;
  const lines = address
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^(\d{5})\s+(.+?)\s+([A-Za-z]{2})$/.exec(lines[i]!);
    if (m) return { cap: m[1]!, city: m[2]!, provinceAbbr: m[3]!.toUpperCase() };
  }
  return null;
}
