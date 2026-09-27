import { describe, expect, it } from "vitest";
import { distanceKm, EARTH_MEAN_RADIUS_KM, type LatLon } from "@/modules/geo/domain";
import {
  freeZoneMatch,
  isCandidateInFreeZone,
  isInFreeZone,
  requiresNationalPlan,
  type CompanySiteForZone,
  type PlaceForZone,
} from "./index";

// Test di accettazione WP-005 (ADR-0009), scritti dall'architetto. NON modificarli per far passare il codice.

const KM_PER_DEGREE_LAT = (2 * Math.PI * EARTH_MEAN_RADIUS_KM) / 360;
/** Punto a `km` chilometri a nord di `p` (lungo il meridiano la distanza è esatta). */
const north = (p: LatLon, km: number): LatLon => ({
  lat: p.lat + km / KM_PER_DEGREE_LAT,
  lon: p.lon,
});

const ORIGIN: LatLon = { lat: 44.0, lon: 11.0 };
const site = (over: Partial<CompanySiteForZone> = {}): CompanySiteForZone => ({
  municipalityCode: "000001",
  regionCode: "08",
  approved: true,
  location: ORIGIN,
  ...over,
});
const place = (
  regionCode: string,
  location: LatLon,
  municipalityCode = "000099",
): PlaceForZone => ({
  municipalityCode,
  regionCode,
  location,
});

describe("distanza", () => {
  it("è zero per lo stesso punto e simmetrica", () => {
    const a = { lat: 45.0526, lon: 9.6934 };
    const b = { lat: 45.3097, lon: 9.5037 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  it("il costruttore di test sposta davvero di N km", () => {
    expect(distanceKm(ORIGIN, north(ORIGIN, 50))).toBeCloseTo(50, 6);
  });
});

describe("zona gratuita (regione ∪ 50 km)", () => {
  it("stesso comune → gratis", () => {
    expect(isInFreeZone([site()], place("08", ORIGIN, "000001"))).toBe(true);
  });

  it("stessa regione a 200 km → gratis (motivo: stessa regione)", () => {
    const m = freeZoneMatch([site()], place("08", north(ORIGIN, 200)));
    expect(m).toEqual({ kind: "same_region", siteMunicipalityCode: "000001" });
  });

  it("regione diversa a 30 km → gratis (motivo: entro il raggio)", () => {
    const m = freeZoneMatch([site()], place("03", north(ORIGIN, 30)));
    expect(m?.kind).toBe("within_radius");
    expect(m?.kind === "within_radius" && m.distanceKm).toBeCloseTo(30, 3);
  });

  it("regione diversa a 49,9 km → gratis", () => {
    expect(isInFreeZone([site()], place("03", north(ORIGIN, 49.9)))).toBe(true);
  });

  it("regione diversa a 50 km esatti → gratis ('entro 50 km' è inclusivo)", () => {
    expect(isInFreeZone([site()], place("03", north(ORIGIN, 50 - 1e-9)))).toBe(true);
  });

  it("regione diversa a 50,1 km → a pagamento", () => {
    expect(isInFreeZone([site()], place("03", north(ORIGIN, 50.1)))).toBe(false);
    expect(requiresNationalPlan([site()], place("03", north(ORIGIN, 50.1)))).toBe(true);
  });

  it("le sedi non approvate vengono ignorate", () => {
    expect(isInFreeZone([site({ approved: false })], place("08", ORIGIN))).toBe(false);
  });

  it("più sedi: basta una sede approvata valida", () => {
    const sites = [
      site({ approved: false, regionCode: "03" }),
      site({ municipalityCode: "000002", regionCode: "12", location: { lat: 41.9, lon: 12.5 } }),
    ];
    expect(isInFreeZone(sites, place("12", { lat: 40.0, lon: 16.0 }))).toBe(true); // stessa regione della 2ª sede
    expect(isInFreeZone(sites, place("03", ORIGIN))).toBe(false); // la sede lombarda non è approvata
  });

  it("con più sedi entro il raggio, indica la più vicina", () => {
    const sites = [
      site({ municipalityCode: "LONTANA", location: north(ORIGIN, -40) }),
      site({ municipalityCode: "VICINA", location: north(ORIGIN, -10) }),
    ];
    const m = freeZoneMatch(sites, place("03", ORIGIN));
    expect(m?.kind === "within_radius" && m.siteMunicipalityCode).toBe("VICINA");
  });

  it("nessuna sede → a pagamento", () => {
    expect(isInFreeZone([], place("08", ORIGIN))).toBe(false);
  });

  it("caso reale: sede a Piacenza (Emilia-Romagna) → Lodi (Lombardia, ~32 km) gratis, Milano (~58 km) no", () => {
    const piacenza = site({
      municipalityCode: "033032",
      regionCode: "08",
      location: { lat: 45.0526, lon: 9.6934 },
    });
    expect(isInFreeZone([piacenza], place("03", { lat: 45.3097, lon: 9.5037 }, "098031"))).toBe(
      true,
    );
    expect(isInFreeZone([piacenza], place("03", { lat: 45.4642, lon: 9.19 }, "015146"))).toBe(
      false,
    );
  });
});

describe("candidati (Fase B)", () => {
  it("un candidato lontano che ha scelto di trasferirsi nella regione della sede è visibile gratis", () => {
    const candidate = {
      ...place("19", { lat: 38.1157, lon: 13.3615 }),
      relocationRegionCodes: ["08"],
    };
    expect(isCandidateInFreeZone([site()], candidate)).toBe(true);
  });

  it("senza disponibilità a trasferirsi, un candidato lontano non è nella zona gratuita", () => {
    const candidate = { ...place("19", { lat: 38.1157, lon: 13.3615 }), relocationRegionCodes: [] };
    expect(isCandidateInFreeZone([site()], candidate)).toBe(false);
  });

  it("la disponibilità a trasferirsi non vale per sedi non approvate", () => {
    const candidate = {
      ...place("19", { lat: 38.1157, lon: 13.3615 }),
      relocationRegionCodes: ["08"],
    };
    expect(isCandidateInFreeZone([site({ approved: false })], candidate)).toBe(false);
  });
});
