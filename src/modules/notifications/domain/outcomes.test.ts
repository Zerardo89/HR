import { describe, expect, it } from "vitest";
import {
  isNotifiedApplicationStatus,
  renderApplicationUpdate,
  renderCompanyVerified,
  renderOfferOutcome,
  renderSiteOutcome,
} from "./outcomes";

// Test di accettazione WP-020c (email di esito). NON modificarli per farli passare.

const appUrl = "https://esempio.it";
const offerId = "00000000-0000-4000-8000-000000000001";

describe("esito dell'offerta", () => {
  it("approvata: titolo e link all'offerta nell'area azienda", () => {
    const { subject, text } = renderOfferOutcome({
      appUrl,
      offerId,
      title: "Cuoco/a",
      decision: { approved: true },
    });
    expect(subject).toBe("La tua offerta «Cuoco/a» è pubblicata");
    expect(text).toContain(`${appUrl}/azienda/offerte/${offerId}`);
  });

  it("rifiutata: motivo (DSA art. 17), nota del moderatore se c'è, di nuovo in bozza", () => {
    const { subject, text } = renderOfferOutcome({
      appUrl,
      offerId,
      title: "Cuoco/a",
      decision: { approved: false, reason: "salary", note: "Indica anche il massimo." },
    });
    expect(subject).toBe("La tua offerta «Cuoco/a» non è stata pubblicata");
    expect(text).toContain("Motivo: Lo stipendio manca o non è credibile.");
    expect(text).toContain("Nota della moderazione: Indica anche il massimo.");
    expect(text).toContain("tornata in bozza");
    const withoutNote = renderOfferOutcome({
      appUrl,
      offerId,
      title: "Cuoco/a",
      decision: { approved: false, reason: "sconosciuto" },
    }).text;
    expect(withoutNote).not.toContain("Nota della moderazione");
    expect(withoutNote).toContain("Non rispetta il regolamento degli annunci.");
  });
});

describe("esito della sede e dell'azienda", () => {
  it("sede approvata o rifiutata con il motivo", () => {
    expect(renderSiteOutcome({ appUrl, place: "Lodi (LO)", decision: { approved: true } })).toEqual(
      expect.objectContaining({ subject: "Sede di Lodi (LO) approvata" }),
    );
    const rejected = renderSiteOutcome({
      appUrl,
      place: "Lodi (LO)",
      decision: { approved: false, reason: "not_found" },
    });
    expect(rejected.subject).toBe("Sede di Lodi (LO) non approvata");
    expect(rejected.text).toContain("Motivo: l'attività non risulta in quel comune.");
    expect(rejected.text).toContain(`${appUrl}/azienda/sedi`);
  });

  it("azienda verificata", () => {
    const { subject, text } = renderCompanyVerified({ appUrl, company: "Osteria Finta" });
    expect(subject).toBe("Osteria Finta è verificata");
    expect(text).toContain(`${appUrl}/azienda`);
  });
});

describe("aggiornamento della candidatura", () => {
  it("email solo per 'ti contatterà', 'altri candidati' e 'assunta/o'", () => {
    for (const s of ["contacted", "rejected", "hired"])
      expect(isNotifiedApplicationStatus(s)).toBe(true);
    for (const s of ["sent", "viewed", "in_review", "withdrawn", "closed"]) {
      expect(isNotifiedApplicationStatus(s)).toBe(false);
    }
  });

  it("testo con azienda e offerta, link alle candidature e avviso anti-truffa", () => {
    const { subject, text } = renderApplicationUpdate({
      appUrl,
      title: "Cuoco/a",
      company: "Osteria Finta",
      status: "contacted",
    });
    expect(subject).toBe("Novità sulla tua candidatura per «Cuoco/a»");
    expect(text).toContain(
      "Osteria Finta ha letto la tua candidatura per «Cuoco/a» e ti contatterà.",
    );
    expect(text).toContain(`${appUrl}/candidature`);
    expect(text).toContain("nessuna azienda seria ti chiede soldi");
    expect(
      renderApplicationUpdate({
        appUrl,
        title: "Cuoco/a",
        company: "Osteria Finta",
        status: "rejected",
      }).text,
    ).toContain(`${appUrl}/offerte`);
  });
});
