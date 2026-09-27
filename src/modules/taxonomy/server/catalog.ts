import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { occupations } from "@/lib/db/schema";
import {
  OCCUPATION_CATEGORIES,
  prepareCatalog,
  type CatalogEntry,
  type OccupationCategory,
  type PreparedCatalog,
} from "../domain";

export type OccupationCatalog = { entries: CatalogEntry[]; prepared: PreparedCatalog };

const TTL_MS = 10 * 60_000;
const store = globalThis as typeof globalThis & {
  __hrOccupations?: { loadedAt: number; catalog: OccupationCatalog };
};

function isCategory(value: string): value is OccupationCategory {
  return value in OCCUPATION_CATEGORIES;
}

/** Elenco delle mansioni dal DB, tenuto in memoria 10 minuti (cambia solo con `pnpm taxonomy:import`). */
export async function getOccupationCatalog(): Promise<OccupationCatalog> {
  const cached = store.__hrOccupations;
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.catalog;

  const rows = await getDb()
    .select({
      id: occupations.id,
      slug: occupations.slug,
      labelIt: occupations.labelIt,
      category: occupations.category,
      groupCode: occupations.groupCode,
      synonyms: occupations.synonyms,
    })
    .from(occupations)
    .orderBy(asc(occupations.labelIt));
  const entries: CatalogEntry[] = rows.flatMap((r) =>
    isCategory(r.category) ? [{ ...r, category: r.category }] : [],
  );
  const catalog = { entries, prepared: prepareCatalog(entries) };
  store.__hrOccupations = { loadedAt: Date.now(), catalog };
  return catalog;
}
