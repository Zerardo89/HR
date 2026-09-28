/**
 * Conservazione (R-PRIV-03, docs/04 §8, WP-023b). Funzioni pure: le soglie e le date.
 * - Nessuna attività per 6 mesi → profilo nascosto + avviso.
 * - 23 mesi → preavviso di cancellazione; 24 mesi (e almeno 30 giorni dopo il preavviso) → cancellazione.
 *   Se l'utente torna nel frattempo, il preavviso decade.
 * - Log di sicurezza: 12 mesi. Lista d'attesa: chi si è registrato esce subito; gli altri 6 mesi dopo il lancio.
 */

export const INACTIVE_HIDE_MONTHS = 6;
export const DELETE_NOTICE_MONTHS = 23;
export const DELETE_AFTER_MONTHS = 24;
export const DELETE_NOTICE_DAYS = 30;
export const AUDIT_RETENTION_MONTHS = 12;
export const LAUNCH_DATE = new Date("2026-11-01T00:00:00+01:00");
export const WAITLIST_RETENTION_MONTHS = 6;
/** 6 mesi dopo il lancio, in ora italiana (data esplicita: niente aritmetica sui mesi a cavallo del 31). */
export const WAITLIST_DELETE_FROM = new Date("2027-05-01T00:00:00+02:00");

/** Stesso giorno di `months` mesi prima; se quel giorno non esiste (31 → aprile), l'ultimo del mese. */
export function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function monthsAfter(date: Date, months: number): Date {
  return monthsBefore(date, -months);
}

const romeDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data annunciata nel preavviso: 30 giorni dopo, ma non prima dei 24 mesi di inattività. */
export function scheduledDeletion(lastActiveAt: Date, noticeAt: Date): Date {
  return new Date(
    Math.max(
      noticeAt.getTime() + DELETE_NOTICE_DAYS * 24 * 60 * 60_000,
      monthsAfter(lastActiveAt, DELETE_AFTER_MONTHS).getTime(),
    ),
  );
}

/**
 * Cancellazione ammessa dal giorno annunciato (in ora italiana) in poi, se l'utente non è tornato dopo il preavviso.
 * Si confronta il giorno e non l'istante: il job gira una volta al giorno, a orari che variano di qualche secondo
 * (e di un'ora col cambio d'ora), e la promessa fatta nella mail è "il giorno X".
 */
export function canDeleteInactive(lastActiveAt: Date, noticeAt: Date | null, now: Date): boolean {
  if (!noticeAt) return false;
  if (lastActiveAt.getTime() > noticeAt.getTime()) return false; // è tornato dopo il preavviso
  return romeDay.format(now) >= romeDay.format(scheduledDeletion(lastActiveAt, noticeAt));
}

export function waitlistExpired(now: Date): boolean {
  return now.getTime() >= WAITLIST_DELETE_FROM.getTime();
}
