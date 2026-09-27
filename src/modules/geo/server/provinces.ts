import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { provinces } from "@/lib/db/schema";
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
