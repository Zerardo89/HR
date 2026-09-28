import { PgBoss } from "pg-boss";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SCHEDULE_TZ, scheduledJobs } from "./jobs";

/*
 * Worker pg-boss (WP-020, ADR-0003): job pianificati su code nello stesso Postgres (schema `pgboss`).
 * Avvio: `pnpm worker`. Gira come processo separato dal sito; più istanze non duplicano i job
 * (pg-boss crea un solo job per ogni scadenza del cron).
 */

const QUEUE_OPTIONS = {
  // Riprova due volte, a 5 e 10 minuti; un giro che dura più di 30 minuti è considerato bloccato.
  retryLimit: 2,
  retryDelay: 300,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  // Un solo giro alla volta per job.
  policy: "singleton",
} as const;

/** `pnpm worker --once alerts.send`: esegue subito un job e termina (verifiche e test end-to-end). */
async function runOnce(name: string | undefined): Promise<void> {
  const job = scheduledJobs.find((j) => j.name === name);
  if (!job)
    throw new Error(`Job sconosciuto. Disponibili: ${scheduledJobs.map((j) => j.name).join(", ")}`);
  const summary = await job.run();
  logger.info({ job: job.name, ...summary }, "job eseguito una volta");
}

async function main(): Promise<void> {
  const once = process.argv.indexOf("--once");
  if (once >= 0) {
    await runOnce(process.argv[once + 1]);
    process.exit(0);
  }
  const env = getServerEnv();
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: "pgboss",
    application_name: "hr-worker",
    max: 4,
  });
  // Solo il tipo di errore: i messaggi di Postgres possono contenere valori (R-PRIV-05).
  boss.on("error", (error: Error) => logger.error({ err: error.name }, "pg-boss: errore"));
  await boss.start();

  for (const job of scheduledJobs) {
    const { policy, ...options } = QUEUE_OPTIONS;
    await boss.createQueue(job.name, { policy, ...options });
    await boss.updateQueue(job.name, options);
    // `missed: "once"`: se il worker era fermo all'ora prevista, il job parte una volta sola al riavvio.
    await boss.schedule(job.name, job.cron, null, { tz: SCHEDULE_TZ, missed: "once" });
    await boss.work(job.name, async () => {
      const started = Date.now();
      const summary = await job.run();
      logger.info({ job: job.name, ms: Date.now() - started, ...summary }, "job completato");
    });
  }
  logger.info({ jobs: scheduledJobs.map((j) => j.name) }, "worker avviato");

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    logger.info("worker in chiusura");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
}

main().catch((error: unknown) => {
  // La configurazione mancante si nomina (solo nomi di variabili, mai valori); il resto solo per tipo.
  const message = (error as Error).message ?? "";
  const config = /^(Configurazione non valida|Job sconosciuto)/.test(message) ? message : undefined;
  logger.fatal({ err: (error as Error).name, config }, "worker non avviato");
  process.exit(1);
});
