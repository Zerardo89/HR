import { z } from "zod";
import { fillTemplate, messages } from "@/i18n/messages";
import { parseSearchParams, toSearchParams, type SearchQuery } from "@/modules/matching/domain";
import { formatSalary, type SalaryFields } from "@/modules/offers/domain";
import type { WorkerState } from "@/modules/profiles/domain";

/**
 * Avvisi email per le ricerche salvate (WP-020). Funzioni pure.
 * - L'avviso ripete ESATTAMENTE una ricerca di `/offerte` e contiene solo le offerte pubblicate dopo l'ultimo
 *   controllo. Nessuna zona gratuita per chi cerca: il raggio lo sceglie il lavoratore (ADR-0009).
 * - Partono solo per chi è "Cerco lavoro" o non ha ancora un profilo (01-PRODOTTO §6.1).
 * - Un'email al giorno al massimo per persona, con tutte le sue ricerche, niente pubblicità (02 §5, art. 130)
 *   e disiscrizione con un clic (RFC 8058, R-MAIL-01).
 */

export const ALERT_FREQUENCIES = ["daily", "weekly"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const MAX_SAVED_SEARCHES = 5;
/** Offerte mostrate per ricerca nell'email; per le altre c'è il link alla ricerca. */
export const ALERT_OFFERS_PER_SEARCH = 5;
/** Il link di disiscrizione resta valido a lungo: le email si riaprono anche settimane dopo. */
export const UNSUBSCRIBE_TOKEN_DAYS = 60;
/** Versione del testo con cui il lavoratore chiede gli avvisi (registrata nei consensi). */
export const JOB_ALERTS_CONSENT_VERSION = "avvisi-2026-09-28";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Il job gira una volta al giorno alla stessa ora: margine per i minuti di ritardo e il cambio dell'ora. */
const DUE_SLACK_MS = 2 * HOUR_MS;

/** Forma canonica della ricerca salvata: niente pagina né filtro "pubblicate negli ultimi giorni". */
export function alertParams(query: SearchQuery): string {
  return toSearchParams(query, { page: 1, publishedWithinDays: undefined });
}

/** La ricerca salvata, di nuovo come ricerca (valori non validi ignorati, come nella pagina). */
export function alertQuery(params: string): SearchQuery {
  const search = new URLSearchParams(params);
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    record[key] = values.length > 1 ? values : values[0]!;
  }
  return { ...parseSearchParams(record), page: 1, publishedWithinDays: undefined };
}

/** Serve un "cosa" o un "dove": un avviso su tutte le offerte d'Italia sarebbe solo rumore. */
export function canSaveAlert(query: SearchQuery): boolean {
  return Boolean(query.q || query.dove);
}

export function isAlertDue(frequency: AlertFrequency, checkedUntil: Date, now: Date): boolean {
  const period = frequency === "daily" ? DAY_MS : 7 * DAY_MS;
  return now.getTime() - checkedUntil.getTime() >= period - DUE_SLACK_MS;
}

/** 01-PRODOTTO §6.1: avvisi solo per chi cerca; "aperto" riceve la mail mensile, "nascosto" nulla. */
export function alertsActiveFor(profileState: WorkerState | null): boolean {
  return profileState === null || profileState === "seeking";
}

export const saveAlertInput = z.object({
  params: z.string().max(500),
  frequency: z.enum(ALERT_FREQUENCIES),
});

export const alertIdInput = z.object({ id: z.uuid() });

export const alertFrequencyInput = z.object({
  id: z.uuid(),
  frequency: z.enum(ALERT_FREQUENCIES),
});

// ─── Testo dell'email ────────────────────────────────────────────────────────────────────────────────

type Labels = {
  contracts: Record<string, string>;
  schedules: Record<string, string>;
};

/** "«cameriere» · Lodi (LO), entro 20 km · Tempo indeterminato" — la ricerca in parole, per email e pagina. */
export function describeAlert(query: SearchQuery, labels: Labels = formLabels()): string {
  const t = messages.alerts.describe;
  const parts: string[] = [];
  if (query.q) parts.push(fillTemplate(t.what, { q: query.q }));
  if (query.dove) {
    parts.push(fillTemplate(t.where, { place: query.dove, km: String(query.radiusKm) }));
  }
  if (query.contractTypes.length > 0) {
    parts.push(query.contractTypes.map((c) => labels.contracts[c] ?? c).join(", "));
  }
  if (query.schedules.length > 0) {
    parts.push(query.schedules.map((s) => labels.schedules[s] ?? s).join(", "));
  }
  if (query.minMonthlySalary) {
    parts.push(fillTemplate(t.salary, { amount: String(query.minMonthlySalary) }));
  }
  return parts.join(" · ");
}

function formLabels(): Labels {
  return { contracts: messages.offers.form.contracts, schedules: messages.offers.form.schedules };
}

export type AlertOffer = SalaryFields & {
  id: string;
  title: string;
  companyName: string;
  municipality: string;
  provinceAbbr: string;
};

export type AlertSection = {
  query: SearchQuery;
  frequency: AlertFrequency;
  offers: readonly AlertOffer[];
  total: number;
};

/** "Da 1400 € a 1600 € lordi al mese", oppure "Stipendio da concordare" (per email senza next-intl). */
export function offerSalaryText(offer: SalaryFields): string {
  const t = messages.publicOffer;
  const translate = (key: string, values: Record<string, string> = {}) => {
    const [head, tail] = key.split(".") as [string, string | undefined];
    const entry = (t as Record<string, unknown>)[head];
    const template = tail ? (entry as Record<string, string>)[tail] : entry;
    return fillTemplate(typeof template === "string" ? template : key, values);
  };
  return formatSalary(offer, translate) ?? messages.search.salaryMissing;
}

/**
 * Email con le nuove offerte di tutte le ricerche dovute di una persona. Solo dati degli annunci (pubblici):
 * nessun dato personale, nemmeno il nome del destinatario.
 */
export function renderAlertEmail(input: {
  sections: readonly AlertSection[];
  appUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string } {
  const t = messages.emails.jobAlert;
  const total = input.sections.reduce((sum, s) => sum + s.total, 0);
  const subject =
    total === 1 ? t.subjectOne : fillTemplate(t.subjectMany, { count: String(total) });
  const blocks = input.sections.map((s) => {
    const lines = [fillTemplate(t.sectionTitle, { search: describeAlert(s.query) })];
    for (const o of s.offers.slice(0, ALERT_OFFERS_PER_SEARCH)) {
      lines.push(
        fillTemplate(t.offerLine, {
          title: o.title,
          company: o.companyName,
          place: `${o.municipality} (${o.provinceAbbr})`,
          salary: offerSalaryText(o),
          link: `${input.appUrl}/offerte/${o.id}`,
        }),
      );
    }
    const days = s.frequency === "daily" ? 1 : 7;
    const params = toSearchParams(s.query, { publishedWithinDays: days, page: 1 });
    if (s.total > ALERT_OFFERS_PER_SEARCH) {
      lines.push(
        fillTemplate(t.more, {
          count: String(s.total - ALERT_OFFERS_PER_SEARCH),
          link: `${input.appUrl}/offerte?${params}`,
        }),
      );
    }
    return lines.join("\n");
  });
  const values = {
    manage: `${input.appUrl}/avvisi`,
    unsubscribe: input.unsubscribeUrl,
    siteName: messages.meta.siteName,
    appUrl: input.appUrl,
  };
  const text = [
    t.intro,
    ...blocks,
    t.safety,
    fillTemplate(t.footer, values),
    fillTemplate(t.signature, values),
  ].join("\n\n");
  return { subject, text };
}
