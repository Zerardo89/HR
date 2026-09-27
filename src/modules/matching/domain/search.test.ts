import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  monthlyEquivalent,
  PAGE_SIZE,
  parsePlaceText,
  parseSearchParams,
  rankOffers,
  SCORE_WEIGHTS,
  scoreOffer,
  toSearchParams,
  type SearchCandidate,
  type SearchContext,
} from "./index";

// Test di accettazione WP-015 (ricerca, ADR-0005), scritti dall'architetto. NON modificarli per far passare il codice.

const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60_000);

let n = 0;
const offer = (over: Partial<SearchCandidate> = {}): SearchCandidate => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  title: "Cameriere/a di sala",
  companyName: "Trattoria Finta",
  municipality: "Milano",
  provinceAbbr: "MI",
  contractType: "permanent",
  schedule: "full_time",
  hoursPerWeek: null,
  salaryMin: 1400,
  salaryMax: null,
  salaryPeriod: "month",
  salaryBasis: "gross",
  publishedAt: daysAgo(0),
  occupationId: 1,
  occupationGroup: "513",
  distanceKm: 0,
  titleMatch: true,
  descriptionMatch: true,
  ...over,
});

const ctx = (over: Partial<SearchContext> = {}): SearchContext => ({
  occupation: { id: 1, groupCode: "513", label: "Cameriere di sala" },
  hasText: true,
  radiusKm: 20,
  now,
  ...over,
});

describe("parametri della ricerca (indirizzo della pagina)", () => {
  it("valori validi", () => {
    expect(
      parseSearchParams({
        q: "  cameriere   sala ",
        dove: "Castro (LE)",
        raggio: "30",
        contratto: ["permanent", "seasonal"],
        orario: "part_time",
        stipendio: "1200",
        giorni: "7",
        pagina: "2",
      }),
    ).toEqual({
      q: "cameriere sala",
      dove: "Castro (LE)",
      radiusKm: 30,
      contractTypes: ["permanent", "seasonal"],
      schedules: ["part_time"],
      minMonthlySalary: 1200,
      publishedWithinDays: 7,
      page: 2,
    });
  });

  it("ciò che non è valido si ignora, senza errori", () => {
    expect(
      parseSearchParams({
        q: "   ",
        raggio: "37",
        contratto: ["permanent", "inventato", "permanent"],
        orario: "notte",
        stipendio: "-5",
        giorni: "3",
        pagina: "999",
      }),
    ).toEqual({
      q: undefined,
      dove: undefined,
      radiusKm: DEFAULT_RADIUS_KM,
      contractTypes: ["permanent"],
      schedules: [],
      minMonthlySalary: undefined,
      publishedWithinDays: undefined,
      page: 1,
    });
  });

  it("andata e ritorno nell'indirizzo (paginazione)", () => {
    const q = parseSearchParams({ q: "cuoco", dove: "Lodi", raggio: "50", contratto: "seasonal" });
    const back = toSearchParams(q, { page: 3 });
    expect(back).toBe("q=cuoco&dove=Lodi&raggio=50&contratto=seasonal&pagina=3");
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(back)))).toEqual({
      ...q,
      page: 3,
    });
  });

  it("comuni omonimi: la sigla della provincia tra parentesi", () => {
    expect(parsePlaceText("Castro (le)")).toEqual({ name: "Castro", provinceAbbr: "LE" });
    expect(parsePlaceText(" Reggio nell'Emilia ")).toEqual({ name: "Reggio nell'Emilia" });
  });
});

describe("punteggio a pesi pubblici e motivi (perché la vedi)", () => {
  it("pesi di docs/01-PRODOTTO.md §8", () => {
    expect(SCORE_WEIGHTS).toEqual({
      occupation: 40,
      distance: 25,
      skills: 20,
      freshness: 10,
      preferences: 5,
    });
  });

  it("stessa mansione, nel comune cercato, pubblicata oggi: 40 + 25 + 10", () => {
    expect(scoreOffer(offer(), ctx())).toEqual({
      score: 75,
      reasons: [
        { kind: "same_occupation", label: "Cameriere di sala" },
        { kind: "distance", km: 0 },
        { kind: "published", days: 0 },
      ],
    });
  });

  it("vicinanza 1 − distanza/raggio; freschezza che scende a zero in 30 giorni", () => {
    const r = scoreOffer(offer({ distanceKm: 12.4, publishedAt: daysAgo(15) }), ctx());
    // 40 + 25 × (1 − 12,4/20) + 10 × (1 − 15/30) = 40 + 9,5 + 5
    expect(r.score).toBe(54.5);
    expect(r.reasons).toContainEqual({ kind: "distance", km: 12 });
    expect(r.reasons).toContainEqual({ kind: "published", days: 15 });
    expect(scoreOffer(offer({ publishedAt: daysAgo(45) }), ctx()).score).toBe(65);
  });

  it("mansione simile (stesso gruppo) o parole solo nella descrizione valgono metà", () => {
    const similar = scoreOffer(
      offer({ occupationId: 2, titleMatch: false, descriptionMatch: false }),
      ctx(),
    );
    expect(similar.score).toBe(20 + 25 + 10);
    expect(similar.reasons[0]).toEqual({ kind: "similar_occupation", label: "Cameriere di sala" });
    const description = scoreOffer(
      offer({ occupationId: 2, occupationGroup: "512", titleMatch: false }),
      ctx(),
    );
    expect(description.reasons[0]).toEqual({ kind: "description_words" });
    expect(scoreOffer(offer({ occupationId: 2 }), ctx()).reasons[0]).toEqual({
      kind: "title_words",
    });
  });

  it("senza cosa e senza dove: conta solo la freschezza per l'ordine, nessun motivo inventato", () => {
    const r = scoreOffer(
      offer({ distanceKm: null, publishedAt: daysAgo(3) }),
      ctx({ occupation: null, hasText: false, radiusKm: null }),
    );
    expect(r.reasons).toEqual([{ kind: "published", days: 3 }]);
    expect(r.score).toBe(40 + 25 + 9);
  });
});

describe("ordine, filtri e pagine", () => {
  it("ordine per punteggio, poi la più recente; fuori ciò che non c'entra con il cosa", () => {
    const near = offer({ title: "vicina", distanceKm: 2 });
    const far = offer({ title: "lontana", distanceKm: 18 });
    const similar = offer({
      title: "simile",
      distanceKm: 10,
      occupationId: 2,
      titleMatch: false,
      descriptionMatch: false,
    });
    const unrelated = offer({
      title: "estranea",
      occupationId: 3,
      occupationGroup: "712",
      titleMatch: false,
      descriptionMatch: false,
    });
    // vicina 40 + 22,5 + 10 · lontana 40 + 2,5 + 10 · simile 20 + 12,5 + 10
    const page = rankOffers([far, unrelated, similar, near], ctx(), { page: 1 });
    expect(page.results.map((r) => r.title)).toEqual(["vicina", "lontana", "simile"]);
    expect(page.total).toBe(3);
  });

  it("stipendio minimo al mese: anno ÷ 13, ora × ore settimanali × 52 ÷ 12, cifra più alta dell'offerta", () => {
    expect(
      monthlyEquivalent({
        salaryMin: 1300,
        salaryMax: 1500,
        salaryPeriod: "month",
        hoursPerWeek: null,
      }),
    ).toBe(1500);
    expect(
      monthlyEquivalent({
        salaryMin: 26000,
        salaryMax: null,
        salaryPeriod: "year",
        hoursPerWeek: null,
      }),
    ).toBe(2000);
    expect(
      monthlyEquivalent({ salaryMin: 9, salaryMax: null, salaryPeriod: "hour", hoursPerWeek: 20 }),
    ).toBe(780);
    expect(
      monthlyEquivalent({
        salaryMin: 9,
        salaryMax: null,
        salaryPeriod: "hour",
        hoursPerWeek: null,
      }),
    ).toBe(1560);
    expect(
      monthlyEquivalent({
        salaryMin: null,
        salaryMax: null,
        salaryPeriod: null,
        hoursPerWeek: null,
      }),
    ).toBeNull();

    const low = offer({ title: "bassa", salaryMin: 900 });
    const ok = offer({ title: "ok", salaryMin: 1100, salaryMax: 1300 });
    const none = offer({
      title: "autonomo",
      contractType: "self_employed",
      salaryMin: null,
      salaryPeriod: null,
    });
    const page = rankOffers([low, ok, none], ctx(), { page: 1, minMonthlySalary: 1200 });
    expect(page.results.map((r) => r.title)).toEqual(["ok"]);
  });

  it("pagine da 20; una pagina oltre l'ultima mostra l'ultima", () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) =>
      offer({ publishedAt: daysAgo(i % 30) }),
    );
    const first = rankOffers(many, ctx(), { page: 1 });
    expect(first.results).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    const last = rankOffers(many, ctx(), { page: 7 });
    expect(last.page).toBe(2);
    expect(last.results).toHaveLength(5);
    expect(new Set([...first.results, ...last.results].map((r) => r.id)).size).toBe(PAGE_SIZE + 5);
  });
});
