import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/modules/matching/domain";
import {
  ALERT_OFFERS_PER_SEARCH,
  alertParams,
  alertQuery,
  alertsActiveFor,
  canSaveAlert,
  describeAlert,
  isAlertDue,
  renderAlertEmail,
  type AlertOffer,
} from "./alerts";

// Test di accettazione WP-020 (avvisi): regole pure. NON modificarli per farli passare.

const HOUR = 60 * 60_000;

describe("ricerca salvata", () => {
  it("forma canonica: niente pagina né 'ultimi giorni'; riletta dà la stessa ricerca", () => {
    const query = parseSearchParams({
      q: "cameriere",
      dove: "Lodi (LO)",
      raggio: "30",
      contratto: ["permanent", "fixed_term"],
      giorni: "7",
      pagina: "3",
    });
    const params = alertParams(query);
    expect(params).not.toContain("pagina");
    expect(params).not.toContain("giorni");
    expect(alertQuery(params)).toEqual({ ...query, page: 1, publishedWithinDays: undefined });
  });

  it("serve un 'cosa' o un 'dove'", () => {
    expect(canSaveAlert(parseSearchParams({}))).toBe(false);
    expect(canSaveAlert(parseSearchParams({ contratto: "permanent" }))).toBe(false);
    expect(canSaveAlert(parseSearchParams({ q: "cuoco" }))).toBe(true);
    expect(canSaveAlert(parseSearchParams({ dove: "Lodi" }))).toBe(true);
  });

  it("si descrive a parole", () => {
    const query = parseSearchParams({ q: "cuoco", dove: "Lodi (LO)", contratto: "permanent" });
    expect(describeAlert(query)).toBe("«cuoco» · Lodi (LO), entro 20 km · Tempo indeterminato");
  });
});

describe("quando parte l'avviso", () => {
  const checked = new Date("2026-10-10T06:00:30Z"); // giro delle 8 (ora legale), finito dopo 30 secondi

  it("giornaliero: il giro del giorno dopo lo prende, anche se parte qualche secondo prima", () => {
    expect(isAlertDue("daily", checked, new Date("2026-10-11T06:00:05Z"))).toBe(true);
    expect(isAlertDue("daily", checked, new Date("2026-10-10T18:00:00Z"))).toBe(false);
  });

  it("settimanale: dopo sette giorni, non prima", () => {
    expect(isAlertDue("weekly", checked, new Date("2026-10-16T06:00:05Z"))).toBe(false);
    expect(isAlertDue("weekly", checked, new Date("2026-10-17T06:00:05Z"))).toBe(true);
  });

  it("cambio dell'ora: il giorno di 23 ore (marzo) e quello di 25 (ottobre) non saltano l'avviso", () => {
    // 27/03/2027 ore 8 CET → 28/03/2027 ore 8 CEST: 23 ore.
    expect(
      isAlertDue("daily", new Date("2027-03-27T07:00:30Z"), new Date("2027-03-28T06:00:05Z")),
    ).toBe(true);
    // 24/10/2026 ore 8 CEST → 25/10/2026 ore 8 CET: 25 ore.
    expect(
      isAlertDue("daily", new Date("2026-10-24T06:00:30Z"), new Date("2026-10-25T07:00:05Z")),
    ).toBe(true);
    // Settimana con il cambio di marzo: 167 ore.
    expect(
      isAlertDue("weekly", new Date("2027-03-22T07:00:30Z"), new Date("2027-03-29T06:00:05Z")),
    ).toBe(true);
    expect(isAlertDue("daily", checked, new Date(checked.getTime() + 21 * HOUR))).toBe(false);
  });

  it("solo per chi cerca lavoro (o non ha ancora un profilo)", () => {
    expect(alertsActiveFor(null)).toBe(true);
    expect(alertsActiveFor("seeking")).toBe(true);
    expect(alertsActiveFor("open")).toBe(false);
    expect(alertsActiveFor("hidden")).toBe(false);
  });
});

describe("email dell'avviso", () => {
  const offer = (n: number): AlertOffer => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    title: `Cameriere ${n}`,
    companyName: "Osteria Finta",
    municipality: "Lodi",
    provinceAbbr: "LO",
    salaryMin: 1400,
    salaryMax: 1600,
    salaryPeriod: "month",
    salaryBasis: "gross",
  });
  const query = parseSearchParams({ q: "cameriere", dove: "Lodi (LO)" });

  it("offerte con stipendio e link, link alla ricerca per le altre, disiscrizione e gestione", () => {
    const { subject, text } = renderAlertEmail({
      sections: [{ query, frequency: "daily", offers: [1, 2, 3, 4, 5, 6].map(offer), total: 8 }],
      appUrl: "https://esempio.it",
      unsubscribeUrl: "https://esempio.it/avvisi/disiscrizione?token=abc",
    });
    expect(subject).toBe("8 nuove offerte per le tue ricerche");
    expect(text).toContain("Per la ricerca «cameriere» · Lodi (LO), entro 20 km:");
    expect(text).toMatch(/Da 1400\s€ a 1600\s€ lordi al mese/);
    expect(text).toContain("https://esempio.it/offerte/00000000-0000-4000-8000-000000000001");
    // Al massimo 5 offerte per ricerca; le altre con il link alla ricerca degli ultimi giorni.
    expect(text).not.toContain("Cameriere 6");
    expect(text).toContain(`…e altre ${8 - ALERT_OFFERS_PER_SEARCH}: https://esempio.it/offerte?`);
    expect(text).toContain("giorni=1");
    expect(text).toContain("https://esempio.it/avvisi/disiscrizione?token=abc");
    expect(text).toContain("https://esempio.it/avvisi");
    expect(text).toContain("non devi mai pagare nulla");
  });

  it("oggetto al singolare con una sola offerta", () => {
    const { subject } = renderAlertEmail({
      sections: [{ query, frequency: "weekly", offers: [offer(1)], total: 1 }],
      appUrl: "https://esempio.it",
      unsubscribeUrl: "https://esempio.it/x",
    });
    expect(subject).toBe("1 nuova offerta per le tue ricerche");
  });
});
