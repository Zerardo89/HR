import "server-only";

// Modulo `matching` — API pubblica (lato server).
// Ricerca, punteggio spiegabile (ADR-0005), zona gratuita regione ∪ 50 km (ADR-0009).
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
import { getDb } from "@/lib/db";
import { getOccupationCatalog } from "@/modules/taxonomy";
import type { SearchQuery } from "./domain";
import { searchOffers, type SearchOutcome } from "./server/search";

export type { OccupationMatch, PlaceResolution, SearchOutcome, SearchPlace } from "./server/search";

export async function findOffers(query: SearchQuery): Promise<SearchOutcome> {
  const catalog = await getOccupationCatalog();
  return searchOffers({ db: getDb(), occupations: catalog.prepared, now: () => new Date() }, query);
}
