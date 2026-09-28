import { fillTemplate, messages } from "@/i18n/messages";
import type { ReportGround, ReportTarget } from "./reports";

/**
 * Testi delle decisioni (WP-024a). Solo dati pubblici dell'annuncio o dell'azienda e i fatti scritti dal
 * moderatore (senza contatti): mai dati di chi ha segnalato, che resta anonimo per l'azienda.
 */

export type RenderedEmail = { subject: string; text: string };

const longDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

function compose(appUrl: string, subject: string, lines: string[]): RenderedEmail {
  const c = messages.emails.common;
  return {
    subject,
    text: [
      c.intro,
      ...lines,
      fillTemplate(c.signature, { siteName: messages.meta.siteName, appUrl }),
    ].join("\n\n"),
  };
}

export function groundText(ground: ReportGround): string {
  return messages.trust.grounds[ground];
}

type Subject = { targetType: ReportTarget; title: string; company: string };

/**
 * Motivazione (DSA art. 17.3): (a) decisione e portata, (b) fatti e circostanze e se nasce da una segnalazione,
 * (c) uso di mezzi automatici, (d) fondamento giuridico o contrattuale, (f) rimedi.
 */
export function statementOfReasons(
  input: Subject & { ground: ReportGround; facts: string; decidedAt: Date; appUrl: string },
): string {
  const t = messages.trust.statement;
  const values = {
    title: input.title,
    company: input.company,
    date: longDate.format(input.decidedAt),
    facts: input.facts,
    ground: groundText(input.ground),
    contact: `${input.appUrl}/contatti`,
  };
  return [
    fillTemplate(input.targetType === "offer" ? t.offerRemoved : t.companySuspended, values),
    fillTemplate(t.facts, values),
    fillTemplate(t.ground, values),
    fillTemplate(t.automation, values),
    fillTemplate(t.redress, values),
  ].join("\n\n");
}

/** All'azienda: la motivazione completa. */
export function renderDecisionForCompany(
  input: Subject & { statement: string; appUrl: string },
): RenderedEmail {
  const t = messages.emails.reportDecision;
  const subject = fillTemplate(input.targetType === "offer" ? t.offerSubject : t.companySubject, {
    title: input.title,
    company: input.company,
  });
  return compose(input.appUrl, subject, [input.statement]);
}

/** A chi ha segnalato con l'account: ricevuta (art. 16.4). */
export function renderReportReceived(input: Subject & { appUrl: string }): RenderedEmail {
  const t = messages.emails.reportReceived;
  const values = { what: what(input) };
  return compose(input.appUrl, t.subject, [fillTemplate(t.body, values)]);
}

/** A chi ha segnalato con l'account: esito (art. 16.5), senza i fatti (restano tra noi e l'azienda). */
export function renderReportOutcome(
  input: Subject & { appUrl: string } & (
      { decision: "dismiss" } | { decision: "act"; ground: ReportGround }
    ),
): RenderedEmail {
  const t = messages.emails.reportOutcome;
  const values = {
    what: what(input),
    ground: input.decision === "act" ? groundText(input.ground) : "",
    contact: `${input.appUrl}/contatti`,
  };
  const body =
    input.decision === "dismiss"
      ? t.dismissed
      : input.targetType === "offer"
        ? t.offerRemoved
        : t.companySuspended;
  const lines = [fillTemplate(body, values)];
  if (input.decision === "act") lines.push(fillTemplate(t.ground, values));
  lines.push(fillTemplate(t.contact, values));
  return compose(input.appUrl, t.subject, lines);
}

function what(input: Subject): string {
  const t = messages.trust.subjects;
  return fillTemplate(input.targetType === "offer" ? t.offer : t.company, {
    title: input.title,
    company: input.company,
  });
}
