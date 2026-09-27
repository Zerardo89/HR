/**
 * Feature flag (docs/03-ARCHITETTURA.md §9). Letti dall'ambiente con default SICURI:
 * tutto ciò che non è esplicitamente acceso resta spento.
 *
 * - INTERMEDIATION_ENABLED: Fase B (liste per mansione, richieste di contatto) — ADR-0011.
 *   Resta `false` finché non c'è il via libera legale (iscrizione art. 6).
 * - BILLING_ENABLED: pagamenti Stripe — ADR-0010 (serve la P.IVA dell'associazione).
 * - ADSENSE_ENABLED: pubblicità Google con CMP certificata — R-COOK-04.
 * - PREVIEW_MODE: dominio di produzione in "anteprima" fino al 27/10 — WP-010.
 * - FOUNDERS_PERIOD_UNTIL: fine del periodo fondatori (Piano Nazionale gratis) — docs/05-MONETIZZAZIONE.md §4.
 */
export type Flags = {
  intermediationEnabled: boolean;
  billingEnabled: boolean;
  adsenseEnabled: boolean;
  previewMode: boolean;
  foundersPeriodUntil: Date;
};

const DEFAULT_FOUNDERS_PERIOD_UNTIL = "2027-01-31T23:59:59+01:00";

export function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function parseFlags(source: Record<string, string | undefined>): Flags {
  const until = new Date(source.FOUNDERS_PERIOD_UNTIL ?? DEFAULT_FOUNDERS_PERIOD_UNTIL);
  return {
    intermediationEnabled: parseBoolean(source.INTERMEDIATION_ENABLED),
    billingEnabled: parseBoolean(source.BILLING_ENABLED),
    adsenseEnabled: parseBoolean(source.ADSENSE_ENABLED),
    previewMode: parseBoolean(source.PREVIEW_MODE),
    foundersPeriodUntil: Number.isNaN(until.getTime())
      ? new Date(DEFAULT_FOUNDERS_PERIOD_UNTIL)
      : until,
  };
}

export const flags: Flags = parseFlags(process.env);

export function isFoundersPeriod(now: Date = new Date(), f: Flags = flags): boolean {
  return now.getTime() <= f.foundersPeriodUntil.getTime();
}
