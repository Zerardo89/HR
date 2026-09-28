import { describe, expect, it } from "vitest";
import { employmentTypes, jobPostingJsonLd, serializeJsonLd, type PublicOffer } from "./index";

// Test di accettazione WP-014 (dati strutturati per Google for Jobs). NON modificarli per far passare il codice.

const offer: PublicOffer = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Cameriere/a di sala",
  description: "Servizio ai tavoli.\n\nTurni serali <dal martedì> & weekend.",
  companyName: "Trattoria Finta",
  municipality: "Milano",
  provinceAbbr: "MI",
  contractType: "fixed_term",
  schedule: "full_time",
  hoursPerWeek: 40,
  salaryMin: 1400,
  salaryMax: 1600,
  salaryPeriod: "month",
  salaryBasis: "gross",
  ccnl: null,
  occupation: "Cameriere/a di sala",
  publishedAt: new Date("2026-11-02T09:00:00Z"),
  validThrough: new Date("2026-12-02T09:00:00Z"),
};

describe("JobPosting (schema.org)", () => {
  it("contiene i campi richiesti da Google: titolo, descrizione, data, scadenza, azienda, luogo", () => {
    const ld = jobPostingJsonLd(offer, "https://esempio.it/offerte/1");
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Cameriere/a di sala",
      datePosted: "2026-11-02T09:00:00.000Z",
      validThrough: "2026-12-02T09:00:00.000Z",
      hiringOrganization: { "@type": "Organization", name: "Trattoria Finta" },
      jobLocation: {
        address: { addressLocality: "Milano", addressRegion: "MI", addressCountry: "IT" },
      },
      directApply: true, // candidatura sul sito da WP-019
    });
  });

  it("stipendio sempre visibile (R-ANN-01): intervallo o valore singolo, con periodo", () => {
    expect(jobPostingJsonLd(offer, "u").baseSalary).toEqual({
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: { "@type": "QuantitativeValue", minValue: 1400, maxValue: 1600, unitText: "MONTH" },
    });
    const single = jobPostingJsonLd(
      { ...offer, salaryMax: null, salaryPeriod: "hour", salaryMin: 9.5 },
      "u",
    );
    expect(single.baseSalary).toMatchObject({ value: { value: 9.5, unitText: "HOUR" } });
    expect(
      jobPostingJsonLd({ ...offer, salaryMin: null, contractType: "self_employed" }, "u"),
    ).not.toHaveProperty("baseSalary");
  });

  it("il testo dell'azienda non può iniettare HTML né chiudere il tag script", () => {
    const ld = jobPostingJsonLd(offer, "u");
    expect(ld.description).toBe(
      "<p>Servizio ai tavoli.</p><p>Turni serali &lt;dal martedì&gt; &amp; weekend.</p>",
    );
    // Carico di prova (XSS) usato di proposito per verificare la neutralizzazione.
    const serialized = serializeJsonLd({ ...ld, title: "</script><script>alert(1)</script>" }); // nosemgrep
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized).title).toBe("</script><script>alert(1)</script>");
  });

  it("tipi di impiego da orario e contratto", () => {
    expect(employmentTypes({ contractType: "fixed_term", schedule: "full_time" })).toEqual([
      "FULL_TIME",
      "TEMPORARY",
    ]);
    expect(employmentTypes({ contractType: "permanent", schedule: "part_time" })).toEqual([
      "PART_TIME",
    ]);
    expect(employmentTypes({ contractType: "internship", schedule: "full_time" })).toEqual([
      "FULL_TIME",
      "INTERN",
    ]);
    expect(employmentTypes({ contractType: "self_employed", schedule: "flexible" })).toEqual([
      "CONTRACTOR",
    ]);
    expect(employmentTypes({ contractType: "permanent", schedule: "shifts" })).toEqual(["OTHER"]);
  });
});
