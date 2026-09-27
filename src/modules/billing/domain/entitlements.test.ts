import { describe, expect, it } from "vitest";
import { activeEntitlement, foundersGrant, isActive, type Entitlement } from "./index";

// Test di accettazione WP-016 (periodo fondatori e diritti), scritti dall'architetto. NON modificarli per farli passare.

const UNTIL = new Date("2027-01-31T23:59:59+01:00");

describe("periodo fondatori (docs/05-MONETIZZAZIONE.md §4)", () => {
  it("azienda registrata entro il 31/12/2026: Piano Nazionale gratis fino a fine periodo", () => {
    const created = new Date("2026-10-15T10:00:00Z");
    const grant = foundersGrant(created, UNTIL);
    expect(grant).toEqual({
      product: "national",
      validFrom: created,
      validTo: UNTIL,
      source: "founders",
    });
    expect(isActive(grant!, new Date("2027-01-31T12:00:00Z"))).toBe(true);
    expect(isActive(grant!, new Date("2027-02-01T00:00:00+01:00"))).toBe(false);
  });

  it("registrata il 31/12/2026 alle 23:00: fondatrice; il 1° gennaio 2027: no", () => {
    expect(foundersGrant(new Date("2026-12-31T23:00:00+01:00"), UNTIL)).not.toBeNull();
    expect(foundersGrant(new Date("2027-01-01T00:00:01+01:00"), UNTIL)).toBeNull();
  });

  it("se il periodo è già finito (fine anticipata dal flag) non si concede nulla", () => {
    expect(
      foundersGrant(new Date("2026-10-15T10:00:00Z"), new Date("2026-10-01T00:00:00Z")),
    ).toBeNull();
  });
});

describe("diritti attivi", () => {
  const now = new Date("2027-03-10T09:00:00Z");
  const e = (over: Partial<Entitlement>): Entitlement => ({
    product: "national",
    validFrom: new Date("2027-03-01T00:00:00Z"),
    validTo: new Date("2027-04-01T00:00:00Z"),
    source: "stripe",
    ...over,
  });

  it("vale da validFrom (compreso) a validTo (escluso); senza scadenza vale sempre", () => {
    expect(isActive(e({}), now)).toBe(true);
    expect(isActive(e({ validFrom: now }), now)).toBe(true);
    expect(isActive(e({ validTo: now }), now)).toBe(false);
    expect(isActive(e({ validFrom: new Date("2027-03-11T00:00:00Z") }), now)).toBe(false);
    expect(isActive(e({ validTo: null }), now)).toBe(true);
  });

  it("tra più diritti dello stesso prodotto si mostra quello che dura di più", () => {
    const short = e({ validTo: new Date("2027-03-20T00:00:00Z") });
    const long = e({ validTo: new Date("2027-06-01T00:00:00Z"), source: "promo" });
    const featured = e({ product: "featured", validTo: null });
    expect(activeEntitlement([short, long, featured], "national", now)).toBe(long);
    expect(activeEntitlement([short, e({ validTo: null })], "national", now)?.validTo).toBeNull();
    expect(activeEntitlement([featured], "national", now)).toBeNull();
  });
});
