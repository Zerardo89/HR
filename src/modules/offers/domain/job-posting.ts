import type { ContractType, SalaryPeriod } from "./validator";

/**
 * Dati strutturati JobPosting (schema.org) per Google for Jobs (WP-014): il canale di acquisizione gratuito n.1
 * (docs/03 §1). Funzione pura: dall'offerta pubblicata all'oggetto da mettere nella pagina come JSON-LD.
 */
export type PublicOffer = {
  id: string;
  title: string;
  description: string;
  companyName: string;
  municipality: string;
  provinceAbbr: string;
  contractType: ContractType;
  schedule: "full_time" | "part_time" | "shifts" | "weekends" | "flexible";
  hoursPerWeek: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  salaryBasis: "gross" | "net";
  ccnl: string | null;
  occupation: string;
  publishedAt: Date;
  validThrough: Date;
};

const UNIT: Record<SalaryPeriod, string> = { hour: "HOUR", month: "MONTH", year: "YEAR" };

/** Tipi di impiego di schema.org: orario + natura del contratto (più valori ammessi). */
export function employmentTypes(offer: Pick<PublicOffer, "contractType" | "schedule">): string[] {
  const types = new Set<string>();
  if (offer.schedule === "part_time") types.add("PART_TIME");
  else if (offer.schedule === "full_time") types.add("FULL_TIME");
  switch (offer.contractType) {
    case "fixed_term":
    case "seasonal":
    case "agency":
      types.add("TEMPORARY");
      break;
    case "internship":
      types.add("INTERN");
      break;
    case "collaboration":
    case "self_employed":
    case "occasional":
      types.add("CONTRACTOR");
      break;
    default:
      break;
  }
  if (types.size === 0) types.add("OTHER");
  return [...types];
}

export function jobPostingJsonLd(offer: PublicOffer, pageUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: offer.description
      .split(/\n{2,}/)
      // Il testo dell'azienda passa sempre da escapeHtml: qui l'HTML è solo quello dei paragrafi.
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`) // nosemgrep
      .join(""),
    datePosted: offer.publishedAt.toISOString(),
    validThrough: offer.validThrough.toISOString(),
    employmentType: employmentTypes(offer),
    url: pageUrl,
    identifier: { "@type": "PropertyValue", name: offer.companyName, value: offer.id },
    hiringOrganization: { "@type": "Organization", name: offer.companyName },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: offer.municipality,
        addressRegion: offer.provinceAbbr,
        addressCountry: "IT",
      },
    },
    ...(offer.salaryMin != null && offer.salaryPeriod
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "EUR",
            value: {
              "@type": "QuantitativeValue",
              ...(offer.salaryMax != null
                ? { minValue: offer.salaryMin, maxValue: offer.salaryMax }
                : { value: offer.salaryMin }),
              unitText: UNIT[offer.salaryPeriod],
            },
          },
        }
      : {}),
    // Candidatura sul sito arriva con WP-019: fino ad allora niente "directApply".
    directApply: false,
  };
}

/** Il testo dell'offerta è testo semplice: nel JSON-LD (che Google legge come HTML) va reso innocuo. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Per il tag <script type="application/ld+json">: `<` diventa \\u003c, così non si chiude il tag (guida Next.js). */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
