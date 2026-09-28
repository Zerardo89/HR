import { cleanupAuthRows } from "@/modules/identity/jobs";
import { cleanupEmailTokens, sendJobAlerts } from "@/modules/notifications/jobs";

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
];
