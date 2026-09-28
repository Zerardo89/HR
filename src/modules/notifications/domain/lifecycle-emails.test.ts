import { describe, expect, it } from "vitest";
import { renderExpiryNotice, renderPositionClosed } from "./outcomes";

// Test di accettazione WP-022: email del ciclo di vita dell'offerta. NON modificarli per farli passare.

const appUrl = "https://esempio.it";

describe("email del ciclo di vita", () => {
  it("promemoria di scadenza: data in ora italiana, rinnova o chiudi, link all'offerta", () => {
    const { subject, text } = renderExpiryNotice({
      appUrl,
      offerId: "00000000-0000-4000-8000-000000000001",
      title: "Cuoco/a",
      validThrough: new Date("2026-11-12T23:30:00Z"), // già 13 novembre in Italia
    });
    expect(subject).toBe("La tua offerta «Cuoco/a» scade il 13 novembre 2026");
    expect(text).toContain("rinnovala");
    expect(text).toContain("chiudila");
    expect(text).toContain(`${appUrl}/azienda/offerte/00000000-0000-4000-8000-000000000001`);
  });

  it("posizione chiusa: dice se l'ha chiusa l'azienda o se è scaduta; link alla ricerca", () => {
    const closed = renderPositionClosed({
      appUrl,
      title: "Cuoco/a",
      company: "Osteria Finta",
      reason: "closed",
    });
    expect(closed.subject).toBe("La posizione «Cuoco/a» è chiusa");
    expect(closed.text).toContain("Osteria Finta ha chiuso l'offerta «Cuoco/a»");
    expect(closed.text).toContain(`${appUrl}/offerte`);
    expect(closed.text).toContain(`${appUrl}/candidature`);
    const expired = renderPositionClosed({
      appUrl,
      title: "Cuoco/a",
      company: "Osteria Finta",
      reason: "expired",
    });
    expect(expired.text).toContain("L'offerta «Cuoco/a» di Osteria Finta");
    expect(expired.text).toContain("è scaduta");
  });
});
