/**
 * Distanze in linea d'aria tra punti (centroidi dei comuni).
 *
 * Usiamo la sfera con raggio medio WGS84 (6371,0088 km): è lo stesso modello che PostGIS usa con
 * `ST_DWithin(a::geography, b::geography, metri, false)` (use_spheroid = false). Così la funzione pura
 * e la query SQL danno lo stesso risultato anche vicino al confine dei 50 km (ADR-0009).
 */
export type LatLon = { lat: number; lon: number };

export const EARTH_MEAN_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLon(p: LatLon): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}
