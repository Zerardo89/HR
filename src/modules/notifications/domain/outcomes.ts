import { fillTemplate, messages } from "@/i18n/messages";

/**
 * Email di esito (WP-020c). Funzioni pure: solo dati dell'annuncio, della sede o dell'azienda (pubblici o
 * dell'azienda stessa) e il motivo della decisione (DSA art. 17). Mai dati personali di altre persone.
 */

export type RenderedEmail = { subject: string; text: string };

const APPLICATION_UPDATES = ["contacted", "rejected", "hired"] as const;
export type ApplicationUpdate = (typeof APPLICATION_UPDATES)[number];

/** Il lavoratore riceve un'email solo per gli esiti che contano; "in valutazione" si vede nelle candidature. */
export function isNotifiedApplicationStatus(status: string): status is ApplicationUpdate {
  return (APPLICATION_UPDATES as readonly string[]).includes(status);
}

function compose(appUrl: string, subject: string, lines: string[]): RenderedEmail {
  const c = messages.emails.common;
  const values = { siteName: messages.meta.siteName, appUrl };
  return {
    subject,
    text: [c.intro, ...lines, fillTemplate(c.signature, values)].join("\n\n"),
  };
}

export function renderOfferOutcome(input: {
  appUrl: string;
  offerId: string;
  title: string;
  decision: { approved: true } | { approved: false; reason: string; note?: string };
}): RenderedEmail {
  const link = `${input.appUrl}/azienda/offerte/${input.offerId}`;
  if (input.decision.approved) {
    const t = messages.emails.offerApproved;
    return compose(input.appUrl, fillTemplate(t.subject, { title: input.title }), [
      fillTemplate(t.body, { title: input.title, link }),
    ]);
  }
  const t = messages.emails.offerRejected;
  const reasons = messages.moderation.reasons as Record<string, string>;
  const reason = reasons[input.decision.reason] ?? reasons.other!;
  const lines = [fillTemplate(t.body, { title: input.title, reason })];
  if (input.decision.note) lines.push(fillTemplate(t.note, { note: input.decision.note }));
  lines.push(fillTemplate(t.next, { link }));
  return compose(input.appUrl, fillTemplate(t.subject, { title: input.title }), lines);
}

export function renderSiteOutcome(input: {
  appUrl: string;
  place: string;
  decision: { approved: true } | { approved: false; reason: string };
}): RenderedEmail {
  const link = `${input.appUrl}/azienda/sedi`;
  if (input.decision.approved) {
    const t = messages.emails.siteApproved;
    return compose(input.appUrl, fillTemplate(t.subject, { place: input.place }), [
      fillTemplate(t.body, { place: input.place, link }),
    ]);
  }
  const t = messages.emails.siteRejected;
  const reasons = messages.company.sites.reasons as Record<string, string>;
  const reason = reasons[input.decision.reason] ?? reasons.other!;
  return compose(input.appUrl, fillTemplate(t.subject, { place: input.place }), [
    fillTemplate(t.body, { place: input.place, reason, link }),
  ]);
}

export function renderCompanyVerified(input: { appUrl: string; company: string }): RenderedEmail {
  const t = messages.emails.companyVerified;
  return compose(input.appUrl, fillTemplate(t.subject, { company: input.company }), [
    fillTemplate(t.body, { link: `${input.appUrl}/azienda` }),
  ]);
}

export function renderApplicationUpdate(input: {
  appUrl: string;
  title: string;
  company: string;
  status: ApplicationUpdate;
}): RenderedEmail {
  const t = messages.emails.applicationUpdate;
  const values = {
    title: input.title,
    company: input.company,
    search: `${input.appUrl}/offerte`,
    link: `${input.appUrl}/candidature`,
  };
  return compose(input.appUrl, fillTemplate(t.subject, values), [
    fillTemplate(t[input.status], values),
    fillTemplate(t.link, values),
    t.safety,
  ]);
}
