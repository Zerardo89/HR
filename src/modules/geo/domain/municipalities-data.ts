import { z } from "zod";
import { csvToRecords } from "./csv";
import { isValidLatLon } from "./distance";

/**
 * Dati dei comuni per l'import (WP-005).
 *
 * Formato NORMALIZZATO (`data/municipalities.csv`, UTF-8, separatore `,`):
 *   istat_code,name,province_code,province_abbr,province_name,region_code,region_name,lat,lon,population
 *
 * Si costruisce da:
 *   1. l'elenco ufficiale ISTAT dei comuni ("Elenco-comuni-italiani.csv", `;`, licenza CC BY) → codici e nomi;
 *   2. un file di coordinate `codice,lat,lon` (centroidi o municipio) → posizione.
 * Vedi `data/README.md` e `scripts/build-municipalities-csv.ts`.
 */
export const municipalityRowSchema = z.object({
  istat_code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1),
  province_code: z.string().regex(/^\d{3}$/),
  province_abbr: z.string().regex(/^[A-Z]{2}$/),
  province_name: z.string().min(1),
  region_code: z.string().regex(/^\d{2}$/),
  region_name: z.string().min(1),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  population: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().nonnegative().nullable()),
});

export type MunicipalityRow = z.infer<typeof municipalityRowSchema>;

export type ParseResult<T> = { rows: T[]; errors: { line: number; message: string }[] };

// Limiti grossolani dell'Italia: intercettano lat/lon invertite o coordinate sbagliate.
const ITALY_BOUNDS = { minLat: 35.3, maxLat: 47.2, minLon: 6.5, maxLon: 18.6 };

export function isInItaly(lat: number, lon: number): boolean {
  return (
    lat >= ITALY_BOUNDS.minLat &&
    lat <= ITALY_BOUNDS.maxLat &&
    lon >= ITALY_BOUNDS.minLon &&
    lon <= ITALY_BOUNDS.maxLon
  );
}

export function parseNormalizedMunicipalities(text: string): ParseResult<MunicipalityRow> {
  const rows: MunicipalityRow[] = [];
  const errors: ParseResult<MunicipalityRow>["errors"] = [];
  const seen = new Set<string>();
  csvToRecords(text, ",").forEach((record, i) => {
    const line = i + 2; // +1 intestazione, +1 base 1
    const parsed = municipalityRowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
      return;
    }
    const r = parsed.data;
    if (!isValidLatLon(r) || !isInItaly(r.lat, r.lon)) {
      errors.push({ line, message: `coordinate fuori dall'Italia per ${r.istat_code}` });
      return;
    }
    if (seen.has(r.istat_code)) {
      errors.push({ line, message: `codice duplicato ${r.istat_code}` });
      return;
    }
    seen.add(r.istat_code);
    rows.push(r);
  });
  return { rows, errors };
}

/** Trova una colonna dell'elenco ISTAT per parole chiave (le intestazioni ufficiali sono lunghe e cambiano). */
function findColumn(headers: string[], ...keywords: string[]): string {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const match = headers.find((h) => keywords.every((k) => norm(h).includes(norm(k))));
  if (!match) {
    throw new Error(
      `Colonna ISTAT non trovata (${keywords.join(" + ")}). Intestazioni presenti: ${headers.join(" | ")}`,
    );
  }
  return match;
}

export type BuildReport = {
  rows: MunicipalityRow[];
  missingCoordinates: string[]; // comuni ISTAT senza coordinate (es. nati da fusioni recenti)
  unusedCoordinates: string[]; // coordinate di comuni non più esistenti
};

/**
 * Costruisce le righe normalizzate da: elenco ISTAT (`;`) + coordinate (`codice,lat,lon`, `,`).
 * Le coordinate accettano codici con o senza zeri iniziali ("1001" = "001001").
 */
export function buildFromIstat(
  istatCsv: string,
  coordsCsv: string,
  population: Map<string, number> = new Map(),
): BuildReport {
  const istat = csvToRecords(istatCsv, ";");
  if (istat.length === 0) throw new Error("Elenco ISTAT vuoto");
  const headers = Object.keys(istat[0]!);
  const col = {
    code: findColumn(headers, "codice comune", "alfanumerico"),
    name: findColumn(headers, "denominazione in italiano"),
    regionCode: findColumn(headers, "codice regione"),
    regionName: findColumn(headers, "denominazione regione"),
    provinceCode: findColumn(headers, "codice", "territoriale sovracomunale"),
    provinceName: findColumn(headers, "denominazione", "territoriale sovracomunale"),
    abbr: findColumn(headers, "sigla automobilistica"),
  };

  const coords = new Map<string, { lat: number; lon: number }>();
  for (const r of csvToRecords(coordsCsv, ",")) {
    const [codeKey, latKey, lonKey] = Object.keys(r);
    const code = (r[codeKey!] ?? "").padStart(6, "0");
    const lat = Number(r[latKey!]);
    const lon = Number(r[lonKey!]);
    if (/^\d{6}$/.test(code) && Number.isFinite(lat) && Number.isFinite(lon))
      coords.set(code, { lat, lon });
  }

  const rows: MunicipalityRow[] = [];
  const missingCoordinates: string[] = [];
  for (const r of istat) {
    const code = (r[col.code] ?? "").padStart(6, "0");
    const c = coords.get(code);
    if (!c) {
      missingCoordinates.push(code);
      continue;
    }
    rows.push({
      istat_code: code,
      name: r[col.name]!,
      province_code: (r[col.provinceCode] ?? "").padStart(3, "0"),
      province_abbr: (r[col.abbr] ?? "").toUpperCase(),
      province_name: r[col.provinceName]!,
      region_code: (r[col.regionCode] ?? "").padStart(2, "0"),
      region_name: r[col.regionName]!,
      lat: c.lat,
      lon: c.lon,
      population: population.get(code) ?? null,
    });
  }
  const known = new Set(rows.map((r) => r.istat_code));
  const unusedCoordinates = [...coords.keys()].filter((k) => !known.has(k));
  return { rows, missingCoordinates, unusedCoordinates };
}

export function toNormalizedCsv(rows: readonly MunicipalityRow[]): string {
  const header =
    "istat_code,name,province_code,province_abbr,province_name,region_code,region_name,lat,lon,population";
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.istat_code,
      r.name,
      r.province_code,
      r.province_abbr,
      r.province_name,
      r.region_code,
      r.region_name,
      r.lat,
      r.lon,
      r.population,
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
