import { describe, expect, it } from "vitest";
import {
  containsContactData,
  decisionCode,
  renderDecisionForCompany,
  renderReportOutcome,
  renderReportReceived,
  reportDecisionInput,
  reportInput,
  reportInputError,
  statementOfReasons,
} from ".";

// Test di accettazione WP-024a (DSA art. 16-17, R-DSA-03/04, R-PRIV-02). NON modificarli per farli passare.

const offerId = "0b0e2a4c-5d6f-4a1b-8c9d-0e1f2a3b4c5d";

describe("contatti nei testi liberi", () => {
  it("trova email e numeri di telefono, non date, importi o CAP", () => {
    for (const s of [
      "scrivete a mario.rossi@example.com",
      "chiamare il 333 123 4567",
      "whatsapp +39 3331234567",
      "tel. 02-1234-5678",
    ]) {
      expect(containsContactData(s), s).toBe(true);
    }
    for (const s of [
      "pubblicata il 28/09/2026",
      "chiede 150 € per il corso",
      "sede a 26900 Lodi",
      "turni dalle 8 alle 17",
    ]) {
      expect(containsContactData(s), s).toBe(false);
    }
  });
});

describe("segnalazione (art. 16)", () => {
  const base = { offerId, targetType: "offer", reason: "scam", goodFaith: "on" };

  it("serve la dichiarazione di buona fede", () => {
    const r = reportInput.safeParse({ ...base, goodFaith: undefined });
    expect(r.success).toBe(false);
    expect(reportInputError(r.error!)).toBe("good_faith");
  });

  it("descrizione facoltativa, al massimo 1000 caratteri, senza contatti", () => {
    expect(reportInput.parse({ ...base, details: "  " }).details).toBeUndefined();
    expect(reportInput.safeParse({ ...base, details: "x".repeat(1001) }).success).toBe(false);
    const r = reportInput.safeParse({ ...base, details: "Mi hanno scritto da truffa@example.com" });
    expect(r.success).toBe(false);
    expect(reportInputError(r.error!)).toBe("contact_data");
  });

  it("solo annuncio o azienda, solo i motivi previsti", () => {
    expect(reportInput.safeParse({ ...base, targetType: "worker" }).success).toBe(false);
    expect(reportInput.safeParse({ ...base, reason: "antipatico" }).success).toBe(false);
    expect(reportInput.safeParse({ ...base, offerId: "1" }).success).toBe(false);
  });
});

describe("decisione del moderatore", () => {
  const base = { targetType: "offer", targetId: offerId };

  it("archiviare non chiede altro", () => {
    expect(reportDecisionInput.parse({ ...base, decision: "dismiss" })).toEqual({
      ...base,
      decision: "dismiss",
    });
  });

  it("togliere o sospendere richiede fondamento e fatti (20-1000 caratteri, senza contatti)", () => {
    const act = { ...base, decision: "act", ground: "payment_request" };
    expect(reportDecisionInput.safeParse({ ...act, facts: "troppo corto" }).success).toBe(false);
    expect(
      reportDecisionInput.safeParse({ ...base, decision: "act", facts: "x".repeat(30) }).success,
    ).toBe(false);
    expect(
      reportDecisionInput.safeParse({
        ...act,
        facts: "L'annuncio chiede di chiamare il 333 1234567 e pagare",
      }).success,
    ).toBe(false);
    const ok = reportDecisionInput.parse({
      ...act,
      facts: "L'annuncio chiede 150 euro per un corso obbligatorio prima del colloquio.",
    });
    expect(decisionCode(ok)).toBe("remove_offer:payment_request");
    expect(decisionCode({ ...ok, targetType: "company" })).toBe("suspend_company:payment_request");
  });
});

describe("motivazione (art. 17.3)", () => {
  const input = {
    targetType: "offer" as const,
    title: "Magazziniere/a",
    company: "Logistica Finta",
    ground: "payment_request" as const,
    facts: "L'annuncio chiede 150 euro per un corso obbligatorio prima del colloquio.",
    decidedAt: new Date("2026-11-10T10:00:00Z"),
    appUrl: "https://esempio.it",
  };

  it("contiene decisione, fatti, fondamento, mezzi automatici e rimedi", () => {
    const text = statementOfReasons(input);
    expect(text).toContain("10 novembre 2026");
    expect(text).toContain("abbiamo tolto dal sito l'offerta «Magazziniere/a»"); // (a) decisione e portata
    expect(text).toContain(input.facts); // (b) fatti
    expect(text).toContain("segnalazioni"); // (b) nasce da una segnalazione
    expect(text).toContain("D.Lgs. 276/2003 art. 11"); // (d) fondamento
    expect(text).toContain("Non abbiamo usato strumenti automatici"); // (c)
    expect(text).toContain("riesame entro 6 mesi"); // (f) rimedi
    expect(text).toContain("https://esempio.it/contatti");
    expect(text).toContain("giudice");
  });

  it("sospensione dell'azienda: dice cosa comporta", () => {
    const text = statementOfReasons({ ...input, targetType: "company" });
    expect(text).toContain("abbiamo sospeso l'account dell'azienda Logistica Finta");
    expect(text).toContain("le candidature ricevute non sono più consultabili");
  });

  it("email all'azienda: oggetto chiaro e motivazione intera", () => {
    const statement = statementOfReasons(input);
    const mail = renderDecisionForCompany({ ...input, statement });
    expect(mail.subject).toBe("Abbiamo tolto la tua offerta «Magazziniere/a»");
    expect(mail.text).toContain(statement);
  });
});

describe("email a chi ha segnalato (art. 16.4-16.5)", () => {
  const who = {
    targetType: "offer" as const,
    title: "Magazziniere/a",
    company: "Logistica Finta",
    appUrl: "https://esempio.it",
  };

  it("ricevuta ed esito, senza i fatti scritti per l'azienda", () => {
    expect(renderReportReceived(who).text).toContain("«Magazziniere/a» di Logistica Finta");
    const removed = renderReportOutcome({ ...who, decision: "act", ground: "scam" });
    expect(removed.subject).toBe("Esito della tua segnalazione");
    expect(removed.text).toContain("abbiamo tolto l'annuncio dal sito");
    expect(removed.text).toContain("offerte false o truffe");
    const dismissed = renderReportOutcome({ ...who, decision: "dismiss" });
    expect(dismissed.text).toContain("non abbiamo trovato violazioni");
    expect(dismissed.text).toContain("https://esempio.it/contatti");
  });
});
