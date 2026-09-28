import { purgeApplicationMessages } from "@/modules/applications/jobs";
import { cleanupAuthRows } from "@/modules/identity/jobs";
import {
  cleanupEmailTokens,
  sendJobAlerts,
  sendMonthlyCheckEmails,
  sendOfferLifecycleEmails,
} from "@/modules/notifications/jobs";
import { expireOffers } from "@/modules/offers/jobs";
import { purgeAuditLog, purgeWaitlistEntries, runAccountRetention } from "@/modules/privacy/jobs";

/*
 * Job pianificati del worker (WP-020, ADR-0003). Orari in ora italiana: pg-boss calcola il cron nel fuso
 * `Europe/Rome`, quindi il cambio dell'ora (25/10/2026) non sposta gli invii. Niente job tra le 2 e le 3 di
 * notte: in quell'ora il cambio dell'ora la salta o la ripete.
 */

export const SCHEDULE_TZ = "Europe/Rome";

export type ScheduledJob = {
  name: string;
  cron: string;
  /** Riepilogo con soli numeri (mai dati personali): finisce nei log. */
  run: () => Promise<Record<string, number>>;
};

export const scheduledJobs: readonly ScheduledJob[] = [
  {
    name: "maintenance.cleanup",
    cron: "30 3 * * *",
    run: async () => ({ ...(await cleanupAuthRows()), ...(await cleanupEmailTokens()) }),
  },
  {
    // Conservazione (docs/04 §8): messaggi delle candidature oltre la finestra dell'azienda (R-PRIV-03).
    name: "retention.applications",
    cron: "45 3 * * *",
    run: purgeApplicationMessages,
  },
  {
    // R-PRIV-03 (WP-023b): inattività 6 mesi → profilo nascosto; 23 → preavviso; 24 → cancellazione.
    name: "retention.accounts",
    cron: "15 4 * * *",
    run: runAccountRetention,
  },
  {
    // Log di sicurezza: 12 mesi (docs/04 §8). Il trigger di audit_log ammette solo questa cancellazione.
    name: "retention.audit",
    cron: "30 4 * * *",
    run: purgeAuditLog,
  },
  {
    // Lista d'attesa: chi si è registrato esce subito; tutti 6 mesi dopo il lancio.
    name: "retention.waitlist",
    cron: "40 4 * * *",
    run: purgeWaitlistEntries,
  },
  {
    // WP-022 (R-ANN-07): scadenze, promemoria alle aziende, "posizione chiusa" ai candidati. Di mattina:
    // le email di chiusura non partono di notte; le offerte scadute spariscono comunque subito dalla ricerca.
    name: "offers.lifecycle",
    cron: "30 7 * * *",
    run: async () => {
      const expired = await expireOffers();
      const emails = await sendOfferLifecycleEmails();
      if (emails.failures > 0) throw new Error(`email non spedite: ${emails.failures}`);
      return { ...expired, ...emails };
    },
  },
  {
    // 01-PRODOTTO §6: gli invii partono alle 9; gli avvisi un'ora prima, per chi cerca al mattino.
    name: "alerts.send",
    cron: "0 8 * * *",
    run: async () => {
      const summary = await sendJobAlerts();
      // Invii falliti: il job si ripete (pg-boss) e rispedisce solo quelli, già esclusi gli altri.
      if (summary.failures > 0) throw new Error(`avvisi non spediti: ${summary.failures}`);
      return summary;
    },
  },
  {
    // WP-021 (01-PRODOTTO §6.2): mail mensile alle 9; ogni profilo ha il suo giorno (30 giorni dall'adesione).
    name: "monthly.check",
    cron: "0 9 * * *",
    run: async () => {
      const summary = await sendMonthlyCheckEmails();
      if (summary.failures > 0) throw new Error(`mail mensili non spedite: ${summary.failures}`);
      return summary;
    },
  },
];
