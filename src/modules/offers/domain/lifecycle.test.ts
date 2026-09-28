import { describe, expect, it } from "vitest";
import {
  canCloseOffer,
  canRenewOffer,
  effectiveStatus,
  needsExpiryNotice,
  renewedValidThrough,
  renewOfferInput,
} from "./lifecycle";

// Test di accettazione WP-022 (R-ANN-07): ciclo di vita dell'offerta. NON modificarli per farli passare.

const DAY = 24 * 60 * 60_000;
const now = new Date("2026-11-10T10:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * DAY);

describe("scadenza", () => {
  it("una pubblicata oltre la scadenza è già 'scaduta' (anche prima del job)", () => {
    expect(effectiveStatus("published", inDays(-0.01), now)).toBe("expired");
    expect(effectiveStatus("published", null, now)).toBe("expired");
    expect(effectiveStatus("published", inDays(1), now)).toBe("published");
    expect(effectiveStatus("closed", inDays(10), now)).toBe("closed");
    expect(effectiveStatus("draft", null, now)).toBe("draft");
  });

  it("promemoria all'azienda negli ultimi 3 giorni, una volta sola", () => {
    expect(needsExpiryNotice(inDays(3), null, now)).toBe(true);
    expect(needsExpiryNotice(inDays(0.5), null, now)).toBe(true);
    expect(needsExpiryNotice(inDays(3.1), null, now)).toBe(false);
    expect(needsExpiryNotice(inDays(-1), null, now)).toBe(false);
    expect(needsExpiryNotice(inDays(2), inDays(-1), now)).toBe(false);
  });
});

describe("rinnovo e chiusura", () => {
  it("rinnovo solo negli ultimi 7 giorni di un'offerta ancora pubblicata", () => {
    expect(canRenewOffer("published", inDays(7), now)).toBe(true);
    expect(canRenewOffer("published", inDays(1), now)).toBe(true);
    expect(canRenewOffer("published", inDays(8), now)).toBe(false); // niente "sempre in cima"
    expect(canRenewOffer("published", inDays(-1), now)).toBe(false); // scaduta: nuova offerta
    expect(canRenewOffer("closed", inDays(3), now)).toBe(false);
    expect(canRenewOffer("pending_review", inDays(3), now)).toBe(false);
  });

  it("nuova scadenza entro i 60 giorni (R-ANN-07); durate ammesse 15, 30, 45, 60", () => {
    expect(renewedValidThrough(now, 30)).toEqual(inDays(30));
    expect(renewedValidThrough(now, 90)).toEqual(inDays(60));
    const offerId = "00000000-0000-4000-8000-000000000001";
    expect(renewOfferInput.safeParse({ offerId, days: "45" }).success).toBe(true);
    expect(renewOfferInput.safeParse({ offerId, days: "61" }).success).toBe(false);
    expect(renewOfferInput.safeParse({ offerId, days: "10" }).success).toBe(false);
  });

  it("si chiude solo un'offerta pubblicata", () => {
    expect(canCloseOffer("published")).toBe(true);
    for (const s of ["draft", "pending_review", "expired", "closed", "removed"] as const) {
      expect(canCloseOffer(s)).toBe(false);
    }
  });
});
