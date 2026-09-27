import { describe, expect, it } from "vitest";
import { contractType } from "@/lib/db/schema/enums";
import { CONTRACT_TYPES, validateOffer, type OfferContext, type OfferDraft } from "./index";

// Test di accettazione WP-012 (validatore annunci, docs/02 §3), scritti dall'architetto.
// NON modificarli per far passare il codice. Ogni caso cita la regola.

const now = new Date("2026-11-02T09:00:00+01:00");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60_000);

const ctx: OfferContext = {
  now,
  company: {
    status: "verified",
    kind: "employer",
    agencyAuthorization: null,
    displayName: "Trattoria Finta",
    publishedOffers: 5,
  },
  internshipMonthlyMinimum: 600,
};

const good: OfferDraft = {
  title: "Cameriere/a di sala",
  description:
    "Cerchiamo una persona per il servizio ai tavoli, pranzo e cena, 5 giorni su 7. " +
    "Esperienza di almeno 2 anni in ristorazione. Ottima conoscenza dell'italiano. Patente B gradita.",
  contractType: "fixed_term",
  salaryMin: 1400,
  salaryMax: 1600,
  salaryPeriod: "month",
  ccnl: "Turismo - Pubblici esercizi",
  validThrough: days(30),
};

const run = (over: Partial<OfferDraft> = {}, c: Partial<OfferContext> = {}) =>
  validateOffer({ ...good, ...over }, { ...ctx, ...c });
const codes = (over: Partial<OfferDraft> = {}, c: Partial<OfferContext> = {}) =>
  run(over, c).issues.map((i) => i.code);
const withText = (text: string) => ({ description: `${good.description} ${text}` });

describe("annuncio a norma", () => {
  it("un annuncio corretto di un'azienda verificata si pubblica senza moderazione e senza avvisi", () => {
    expect(run()).toEqual({ decision: "publish", issues: [], hints: [] });
  });

  it("i tipi di contratto coincidono con l'enum del DB (R-ANN-05)", () => {
    expect([...CONTRACT_TYPES]).toEqual(contractType.enumValues);
  });
});

describe("R-ANN-01 stipendio", () => {
  it("obbligatorio per il lavoro subordinato, facoltativo per autonomi e occasionali", () => {
    expect(run({ salaryMin: null, salaryMax: null }).decision).toBe("blocked");
    expect(codes({ salaryMin: null, salaryMax: null })).toContain("salary_missing");
    expect(
      codes({ salaryMin: null, salaryMax: null, contractType: "self_employed" }),
    ).not.toContain("salary_missing");
  });

  it("massimo ≥ minimo, periodo indicato, importi plausibili", () => {
    expect(codes({ salaryMax: 1000 })).toContain("salary_range");
    expect(codes({ salaryPeriod: null })).toContain("salary_period_missing");
    expect(codes({ salaryMin: 0 })).toContain("salary_invalid");
    // 1400 "all'ora" è quasi certamente un errore: lo guarda un moderatore
    const hourly = run({ salaryMin: 1400, salaryMax: null, salaryPeriod: "hour" });
    expect(hourly.decision).toBe("moderation");
    expect(hourly.issues.map((i) => i.code)).toEqual(["salary_implausible"]);
  });
});

describe("R-ANN-02 niente domande sullo stipendio precedente", () => {
  it("blocca le domande di preselezione sullo storico retributivo", () => {
    for (const q of [
      "Qual è la tua RAL attuale?",
      "Indica il tuo ultimo stipendio",
      "Quanto guadagni oggi?",
    ]) {
      expect(codes({ screeningQuestions: [q] }), q).toContain("salary_history");
    }
    expect(codes({ screeningQuestions: ["Hai la patente B?"] })).toEqual([]);
  });

  it("indicare la RAL offerta va benissimo", () => {
    expect(codes(withText("RAL 28.000 € più tredicesima e quattordicesima."))).toEqual([]);
  });
});

describe("R-ANN-03 / R-ANN-04 niente discriminazioni", () => {
  it("età: limiti vietati, l'esperienza in anni no", () => {
    for (const t of [
      "Età massima 35 anni.",
      "Max 30 anni.",
      "Tra i 20 e i 30 anni.",
      "Candidati 25-35 anni",
      "Under 30",
    ]) {
      expect(run(withText(t)).decision, t).toBe("blocked");
      expect(codes(withText(t)), t).toContain("age_limit");
    }
    expect(codes(withText("Esperienza di almeno 5 anni nel ruolo."))).toEqual([]);
    expect(codes(withText("Contratto di 12 mesi, max 40 ore settimanali."))).toEqual([]);
  });

  it("in apprendistato il limite d'età è di legge: moderazione, non blocco", () => {
    const r = run({
      contractType: "apprenticeship",
      ...withText("Età massima 29 anni (apprendistato)."),
    });
    expect(r.decision).toBe("moderation");
  });

  it("parole sospette sull'età → moderazione", () => {
    expect(run(withText("Ambiente giovane e dinamico.")).decision).toBe("moderation");
    expect(run(withText("Assunzione agevolata per over 50.")).decision).toBe("moderation");
  });

  it("nazionalità e madrelingua vietate; 'ottima conoscenza dell'italiano' va bene", () => {
    for (const t of [
      "Solo italiani.",
      "No stranieri.",
      "Richiesta cittadinanza italiana.",
      "Italiano madrelingua.",
      "Insegnante madre lingua inglese",
    ]) {
      expect(run(withText(t)).decision, t).toBe("blocked");
    }
  });

  it("aspetto, sesso e auto propria → moderazione (ammessi solo se motivati)", () => {
    expect(codes(withText("Bella presenza."))).toEqual(["appearance"]);
    expect(codes(withText("Cercasi ragazza per il banco."))).toEqual(["gender"]);
    expect(codes({ title: "Cercasi ragazza al banco" })).toContain("gender");
    expect(codes(withText("Solo uomini."))).toEqual(["gender"]);
    expect(codes(withText("Automunito."))).toEqual(["own_car"]);
    expect(codes(withText("Lavoro fisico, con sforzi."))).toEqual([]);
  });
});

describe("R-LAV-05 niente dati non pertinenti", () => {
  it("foto, stato civile, figli, gravidanza → blocco", () => {
    for (const t of [
      "Inviare CV con foto.",
      "Indicare stato civile.",
      "Preferibilmente senza figli.",
      "Nubile.",
    ]) {
      expect(codes(withText(t)), t).toContain("irrelevant_personal_data");
    }
    expect(codes(withText("Inviare CV senza foto."))).toEqual([]);
  });
});

describe("R-LAV-11 e anti-truffa (§3.2)", () => {
  it("soldi chiesti ai candidati → moderazione", () => {
    for (const t of [
      "Richiesta quota di iscrizione di 50 euro.",
      "Investimento iniziale minimo.",
      "Kit a pagamento.",
      "Corso obbligatorio a pagamento.",
    ]) {
      expect(codes(withText(t)), t).toContain("payment_request");
      expect(run(withText(t)).decision, t).toBe("moderation");
    }
    expect(codes(withText("Corso di formazione gratuito e retribuito."))).toEqual([]);
    expect(codes(withText("Versamento dei contributi regolare."))).toEqual([]);
  });

  it("contatti fuori piattaforma, link e dati bancari → moderazione", () => {
    expect(codes(withText("Scrivi su WhatsApp."))).toContain("off_platform_contact");
    expect(codes(withText("Chiama il 333 1234567."))).toContain("off_platform_contact");
    expect(codes(withText("Info su https://esempio.it/lavora"))).toContain("external_link");
    expect(codes(withText("Serve l'IBAN per la registrazione."))).toContain("sensitive_request");
    expect(codes(withText("Inviare copia del documento d'identità."))).toContain(
      "sensitive_request",
    );
  });

  it("le prime 3 offerte di un'azienda nuova passano sempre in moderazione", () => {
    const company = { ...ctx.company, publishedOffers: 2 };
    expect(run({}, { company }).decision).toBe("moderation");
    expect(codes({}, { company })).toEqual(["first_offers"]);
  });
});

describe("R-LAV-02 / R-LAV-03 azienda", () => {
  it("azienda non verificata o senza nome → blocco", () => {
    expect(codes({}, { company: { ...ctx.company, status: "pending" } })).toContain(
      "company_not_verified",
    );
    expect(codes({}, { company: { ...ctx.company, displayName: " " } })).toContain(
      "company_not_verified",
    );
  });

  it("un'agenzia per il lavoro deve avere l'autorizzazione", () => {
    const agency = { ...ctx.company, kind: "agency" as const };
    expect(codes({}, { company: agency })).toContain("agency_authorization_missing");
    expect(
      codes({}, { company: { ...agency, agencyAuthorization: "Aut. Min. prot. 00/0000" } }),
    ).toEqual([]);
  });
});

describe("R-LAV-10 tirocini", () => {
  const stage = {
    contractType: "internship" as const,
    salaryMin: 700,
    salaryMax: null,
    internshipDeclaration: true,
  };
  it("indennità mensile ≥ minimo regionale e dichiarazione obbligatoria", () => {
    expect(run(stage).decision).toBe("publish");
    expect(codes({ ...stage, salaryMin: 500 })).toContain("internship_below_minimum");
    expect(codes({ ...stage, salaryPeriod: "hour", salaryMin: 10 })).toContain(
      "internship_below_minimum",
    );
    expect(codes({ ...stage, internshipDeclaration: false })).toContain(
      "internship_declaration_missing",
    );
  });

  it("minimo regionale non noto → moderazione", () => {
    expect(codes(stage, { internshipMonthlyMinimum: null })).toEqual([
      "internship_minimum_unknown",
    ]);
  });
});

describe("R-ANN-07 scadenza", () => {
  it("obbligatoria, futura, entro 60 giorni", () => {
    expect(codes({ validThrough: null })).toContain("valid_through_missing");
    expect(codes({ validThrough: days(-1) })).toContain("valid_through_past");
    expect(codes({ validThrough: days(61) })).toContain("valid_through_too_far");
    expect(codes({ validThrough: days(60) })).toEqual([]);
  });
});

describe("consigli non bloccanti", () => {
  it("titolo per entrambi i sessi (R-ANN-03) e CCNL consigliato (R-ANN-06)", () => {
    const r = run({ title: "Cameriere di sala", ccnl: null });
    expect(r.decision).toBe("publish");
    expect(r.hints.map((h) => h.code)).toEqual(["title_gender", "ccnl_missing"]);
    expect(run({ title: "Barista (m/f)" }).hints).toEqual([]);
  });

  it("il testo segnalato è riportato per evidenziarlo nel form", () => {
    const issue = run(withText("Età massima 35 anni.")).issues[0]!;
    expect(issue).toMatchObject({ code: "age_limit", rule: "R-ANN-04", field: "description" });
    expect(issue.match).toContain("35 anni");
  });
});
