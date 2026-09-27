import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { municipalities, provinces } from "@/lib/db/schema";
import { normalizePlaceName, parsePlaceText } from "../domain";

/** Comune scelto da chi scrive (ricerca, sedi): codice ISTAT, nome, sigla, regione e centroide. */
export type MunicipalityRef = {
  code: string;
  name: string;
  provinceAbbr: string;
  regionCode: string;
  lat: number;
  lon: number;
};

export type MunicipalityLookup =
  | { status: "found"; place: MunicipalityRef }
  | { status: "ambiguous"; options: MunicipalityRef[] }
  | { status: "not_found"; suggestions: MunicipalityRef[] };

/** Soglia di somiglianza (trigrammi) per i "forse cercavi". */
const SUGGESTION_SIMILARITY = 0.3;

const normalizedName = sql`trim(regexp_replace(lower(unaccent(${municipalities.name})), '[^a-z0-9]+', ' ', 'g'))`;

const columns = {
  code: municipalities.istatCode,
  name: municipalities.name,
  provinceAbbr: provinces.abbreviation,
  regionCode: municipalities.regionCode,
  lat: municipalities.lat,
  lon: municipalities.lon,
};

/**
 * Dal testo scritto da una persona al comune: "Milano", "milano", "Castro (LE)", "Reggio nell Emilia".
 * Più comuni con lo stesso nome → `ambiguous` (si aggiunge la provincia); nessuno → suggerimenti per somiglianza.
 */
export async function findMunicipality(
  db: NodePgDatabase,
  text: string,
): Promise<MunicipalityLookup> {
  const { name, provinceAbbr } = parsePlaceText(text);
  const norm = normalizePlaceName(name);
  if (!norm) return { status: "not_found", suggestions: [] };

  const rows = await db
    .select(columns)
    .from(municipalities)
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(
      and(
        sql`${normalizedName} = ${norm}`,
        provinceAbbr ? eq(provinces.abbreviation, provinceAbbr) : undefined,
      ),
    )
    .orderBy(sql`${municipalities.population} desc nulls last`, municipalities.istatCode)
    .limit(10);
  if (rows.length === 1) return { status: "found", place: rows[0]! };
  if (rows.length > 1) return { status: "ambiguous", options: rows };

  const similarity = sql`similarity(${normalizedName}, ${norm}::text)`;
  const suggestions = await db
    .select(columns)
    .from(municipalities)
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(sql`${similarity} >= ${SUGGESTION_SIMILARITY}`)
    .orderBy(desc(similarity), sql`${municipalities.population} desc nulls last`)
    .limit(5);
  return { status: "not_found", suggestions };
}
