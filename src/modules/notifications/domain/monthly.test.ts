import { describe, expect, it } from "vitest";
import {
  monthlyAction,
  monthlyAnswerInput,
  monthlyChoice,
  renderMonthlyCheck,
  renderMonthlyPaused,
} from "./monthly";
import type { AlertOffer } from "./alerts";

// Test di accettazione WP-021: testo della mail mensile e scelte. NON modificarli per farli passare.

const appUrl = "https://esempio.it";
const offer = (n: number): AlertOffer => ({
  id: `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  title: `Cuoco/a ${n}`,
  companyName: "Trattoria Finta",
  municipality: "Lodi",
  provinceAbbr: "LO",
  salaryMin: 1500,
  salaryMax: null,
  salaryPeriod: "month",
  salaryBasis: "gross",
});
const links = {
  seeking: `${appUrl}/mensile?token=T&scelta=cerco`,
  open: `${appUrl}/mensile?token=T&scelta=aperto`,
  hide: `${appUrl}/mensile?token=T&scelta=nascondi`,
  delete: `${appUrl}/mensile?token=T&scelta=cancella`,
};

describe("mail mensile", () => {
  it("fino a 10 offerte, 'vedi tutte', le quattro risposte, disiscrizione; niente pubblicità", () => {
    const { subject, text } = renderMonthlyCheck({
      appUrl,
      place: "Lodi (LO)",
      offers: Array.from({ length: 12 }, (_, i) => offer(i + 1)),
      total: 12,
      seeAllUrl: `${appUrl}/offerte?q=cuoco`,
      links,
      unsubscribeUrl: `${appUrl}/mensile?token=T&scelta=stop`,
    });
    expect(subject).toBe("Stai ancora cercando lavoro? 12 offerte per te vicino a Lodi (LO)");
    expect(text).toContain("Cuoco/a 10");
    expect(text).not.toContain("Cuoco/a 11");
    expect(text).toContain(`Vedi tutte le offerte (12): ${appUrl}/offerte?q=cuoco`);
    for (const url of Object.values(links)) expect(text).toContain(url);
    expect(text).toContain("Sì, sto cercando");
    expect(text).toContain("Cancella il mio profilo");
    expect(text).toContain(`${appUrl}/mensile?token=T&scelta=stop`);
    expect(text).toContain("6 mesi di fila");
    expect(text.toLowerCase()).not.toContain("sponsor");
  });

  it("senza offerte il messaggio lo dice e chiede comunque come va", () => {
    const { subject, text } = renderMonthlyCheck({
      appUrl,
      place: "Lodi (LO)",
      offers: [],
      total: 0,
      seeAllUrl: `${appUrl}/offerte`,
      links,
      unsubscribeUrl: `${appUrl}/x`,
    });
    expect(subject).toBe("Stai ancora cercando lavoro? Dicci come va");
    expect(text).toContain("non ci sono offerte nuove");
    expect(text).toContain(links.open);
  });

  it("mail di pausa con il link al profilo", () => {
    const { subject, text } = renderMonthlyPaused({ appUrl });
    expect(subject).toBe("Abbiamo messo in pausa il tuo profilo");
    expect(text).toContain(`${appUrl}/profilo`);
  });

  it("scelte nell'indirizzo: solo quelle previste", () => {
    expect(monthlyAction("cerco")).toBe("seeking");
    expect(monthlyAction("stop")).toBe("stop");
    expect(monthlyAction("elimina-tutto")).toBeNull();
    expect(monthlyAction(undefined)).toBeNull();
    expect(monthlyChoice("hide")).toBe("nascondi");
    const token = "a".repeat(43);
    expect(monthlyAnswerInput.safeParse({ token, action: "delete" }).success).toBe(true);
    expect(monthlyAnswerInput.safeParse({ token, action: "promote" }).success).toBe(false);
    expect(monthlyAnswerInput.safeParse({ token: "corto", action: "open" }).success).toBe(false);
  });
});
