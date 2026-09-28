import { z } from "zod";
import { fillTemplate, messages } from "@/i18n/messages";
import { MONTHLY_ANSWERS, type MonthlyAnswer } from "@/modules/profiles/domain";
import { offerSalaryText, type AlertOffer } from "./alerts";

/**
 * Mail mensile per gli "aperti" (WP-021, 01-PRODOTTO §6.2). Funzioni pure.
 * - Fino a 10 offerte (mansione + raggio, pubblicate negli ultimi 30 giorni) e il link "vedi tutte".
 * - Quattro risposte, ognuna apre una pagina di conferma (R-MAIL-02): cliccare il link non cambia nulla.
 * - Niente pubblicità (resta comunicazione di servizio, art. 130) e niente nome del destinatario.
 * - Un solo token per mail: autorizza la risposta scelta (una volta) e la disiscrizione; vale 30 giorni.
 */

export const MONTHLY_OFFERS = 10;
export const MONTHLY_WINDOW_DAYS = 30;
export const MONTHLY_TOKEN_DAYS = 30;

/** Scelte nell'indirizzo della pagina di conferma (parole italiane, niente dati personali). */
export const MONTHLY_CHOICES = {
  cerco: "seeking",
  aperto: "open",
  nascondi: "hide",
  cancella: "delete",
  stop: "stop",
} as const satisfies Record<string, MonthlyAnswer | "stop">;
export type MonthlyChoice = keyof typeof MONTHLY_CHOICES;
export type MonthlyAction = (typeof MONTHLY_CHOICES)[MonthlyChoice];

export function monthlyAction(choice: unknown): MonthlyAction | null {
  return typeof choice === "string" && choice in MONTHLY_CHOICES
    ? MONTHLY_CHOICES[choice as MonthlyChoice]
    : null;
}

export function monthlyChoice(action: MonthlyAction): MonthlyChoice {
  return (Object.keys(MONTHLY_CHOICES) as MonthlyChoice[]).find(
    (k) => MONTHLY_CHOICES[k] === action,
  )!;
}

export const monthlyAnswerInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  action: z.enum([...MONTHLY_ANSWERS, "stop"]),
});

export function renderMonthlyCheck(input: {
  appUrl: string;
  place: string;
  offers: readonly AlertOffer[];
  total: number;
  seeAllUrl: string;
  /** Link della pagina di conferma per ogni risposta (con il token della mail). */
  links: Record<MonthlyAnswer, string>;
  unsubscribeUrl: string;
}): { subject: string; text: string } {
  const t = messages.emails.monthlyCheck;
  const subject =
    input.total === 0
      ? t.subjectNone
      : input.total === 1
        ? fillTemplate(t.subjectOne, { place: input.place })
        : fillTemplate(t.subjectMany, { count: String(input.total), place: input.place });
  const offers =
    input.offers.length === 0
      ? [t.noOffers]
      : [
          [
            t.offersTitle,
            ...input.offers.slice(0, MONTHLY_OFFERS).map((o) =>
              fillTemplate(t.offerLine, {
                title: o.title,
                company: o.companyName,
                place: `${o.municipality} (${o.provinceAbbr})`,
                salary: offerSalaryText(o),
                link: `${input.appUrl}/offerte/${o.id}`,
              }),
            ),
          ].join("\n"),
          fillTemplate(t.seeAll, { count: String(input.total), link: input.seeAllUrl }),
        ];
  const answers = [
    t.question,
    ...MONTHLY_ANSWERS.map((a) => fillTemplate(t[a], { link: input.links[a] })),
  ].join("\n");
  const values = {
    unsubscribe: input.unsubscribeUrl,
    siteName: messages.meta.siteName,
    appUrl: input.appUrl,
  };
  return {
    subject,
    text: [
      t.intro,
      ...offers,
      answers,
      t.noAnswer,
      t.safety,
      fillTemplate(t.footer, values),
      fillTemplate(t.signature, values),
    ].join("\n\n"),
  };
}

export function renderMonthlyPaused(input: { appUrl: string }): { subject: string; text: string } {
  const t = messages.emails.monthlyPaused;
  const c = messages.emails.common;
  return {
    subject: t.subject,
    text: [
      c.intro,
      fillTemplate(t.body, { link: `${input.appUrl}/profilo` }),
      fillTemplate(c.signature, { siteName: messages.meta.siteName, appUrl: input.appUrl }),
    ].join("\n\n"),
  };
}
