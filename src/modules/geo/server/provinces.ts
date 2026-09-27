import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { provinces, regions } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export type ProvinceOption = { code: string; name: string };

/**
 * Province per i menu a tendina (dati ISTAT importati con `pnpm geo:import`).
 * Se il DB non risponde la pagina funziona lo stesso: il campo provincia non compare.
 */
export async function listProvinces(): Promise<ProvinceOption[]> {
  try {
    return await getDb()
      .select({ code: provinces.code, name: provinces.name })
      .from(provinces)
      .orderBy(asc(provinces.name));
  } catch (error) {
    logger.error({ err: (error as Error).name }, "elenco province non disponibile");
    return [];
  }
}

export type RegionOption = { code: string; name: string };

/** Regioni per "disponibile a trasferirmi in…" (WP-017). Se il DB non risponde: elenco vuoto. */
export async function listRegions(): Promise<RegionOption[]> {
  try {
    return await getDb()
      .select({ code: regions.code, name: regions.name })
      .from(regions)
      .orderBy(asc(regions.name));
  } catch (error) {
    logger.error({ err: (error as Error).name }, "elenco regioni non disponibile");
    return [];
  }
}
