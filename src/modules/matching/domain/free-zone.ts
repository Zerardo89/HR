import { distanceKm, type LatLon } from "@/modules/geo/domain";

/**
 * Zona gratuita dell'azienda (ADR-0009):
 *   per ogni sede APPROVATA → tutti i comuni della sua regione ∪ tutti i comuni entro 50 km in linea d'aria.
 * I lavoratori non sono mai limitati da questa regola: serve solo a decidere cosa è gratis per l'azienda.
 */
export const FREE_ZONE_RADIUS_KM = 50;

export type CompanySiteForZone = {
  municipalityCode: string; // codice ISTAT del comune
  regionCode: string; // codice ISTAT della regione
  approved: boolean;
  location: LatLon; // centroide del comune
};

export type PlaceForZone = {
  municipalityCode: string;
  regionCode: string;
  location: LatLon;
};

/** Motivo per cui un luogo è nella zona gratuita: serve anche a spiegarlo all'utente. */
export type FreeZoneMatch =
  | { kind: "same_region"; siteMunicipalityCode: string }
  | { kind: "within_radius"; siteMunicipalityCode: string; distanceKm: number };

export function freeZoneMatch(
  sites: readonly CompanySiteForZone[],
  place: PlaceForZone,
  radiusKm: number = FREE_ZONE_RADIUS_KM,
): FreeZoneMatch | null {
  const approved = sites.filter((s) => s.approved);

  // La regione ha la precedenza: è la spiegazione più semplice da dare.
  const sameRegion = approved.find((s) => s.regionCode === place.regionCode);
  if (sameRegion) return { kind: "same_region", siteMunicipalityCode: sameRegion.municipalityCode };

  let best: FreeZoneMatch | null = null;
  for (const site of approved) {
    const d = distanceKm(site.location, place.location);
    if (
      d <= radiusKm &&
      (best === null || (best.kind === "within_radius" && d < best.distanceKm))
    ) {
      best = { kind: "within_radius", siteMunicipalityCode: site.municipalityCode, distanceKm: d };
    }
  }
  return best;
}

export function isInFreeZone(
  sites: readonly CompanySiteForZone[],
  place: PlaceForZone,
  radiusKm: number = FREE_ZONE_RADIUS_KM,
): boolean {
  return freeZoneMatch(sites, place, radiusKm) !== null;
}

/**
 * Pubblicare un'offerta con luogo di lavoro fuori zona richiede il Piano Nazionale
 * (durante il periodo fondatori l'entitlement viene concesso gratis: lo decide il modulo billing).
 */
export function requiresNationalPlan(
  sites: readonly CompanySiteForZone[],
  offerPlace: PlaceForZone,
): boolean {
  return !isInFreeZone(sites, offerPlace);
}

export type CandidateForZone = PlaceForZone & { relocationRegionCodes: readonly string[] };

/**
 * (Fase B) Un candidato è consultabile gratis se abita nella zona gratuita dell'azienda
 * OPPURE se ha dichiarato di essere disposto a trasferirsi nella regione di una sede approvata:
 * è una sua scelta e la rispettiamo senza farla pagare a nessuno (docs/01-PRODOTTO.md §5.3).
 */
export function isCandidateInFreeZone(
  sites: readonly CompanySiteForZone[],
  candidate: CandidateForZone,
): boolean {
  if (isInFreeZone(sites, candidate)) return true;
  return sites.some((s) => s.approved && candidate.relocationRegionCodes.includes(s.regionCode));
}
