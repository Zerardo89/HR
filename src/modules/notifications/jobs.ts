import "server-only";
import { lt } from "drizzle-orm";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { emailActionTokens } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import { getOccupationCatalog } from "@/modules/taxonomy/jobs";
import { sendDueAlerts, type AlertRunSummary } from "./server/alerts";
import { sendExpiryNotices, sendPositionClosedEmails } from "./server/lifecycle-emails";
import { sendMonthlyChecks, type MonthlySummary } from "./server/monthly";
import { outcomeRuntimeDeps } from "./server/runtime";

// Modulo `notifications` — API per i job del worker (WP-020): niente componenti né Next.js.

/** Job `alerts.send`: avvisi delle ricerche salvate. */
export async function sendJobAlerts(): Promise<AlertRunSummary> {
  const catalog = await getOccupationCatalog();
  return sendDueAlerts({
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
    occupations: catalog.prepared,
  });
}

/** Pulizia giornaliera: token delle email scaduti (disiscrizione, conferme). */
export async function cleanupEmailTokens(): Promise<{ emailTokensDeleted: number }> {
  const deleted = await getDb()
    .delete(emailActionTokens)
    .where(lt(emailActionTokens.expiresAt, new Date()))
    .returning({ tokenHash: emailActionTokens.tokenHash });
  return { emailTokensDeleted: deleted.length };
}

/** Parte email del job `offers.lifecycle` (WP-022): promemoria di scadenza e "posizione chiusa". */
export async function sendOfferLifecycleEmails(): Promise<{
  expiryNotices: number;
  positionClosed: number;
  failures: number;
}> {
  const deps = outcomeRuntimeDeps();
  const notices = await sendExpiryNotices(deps);
  const closed = await sendPositionClosedEmails(deps);
  return {
    expiryNotices: notices.sent,
    positionClosed: closed.sent,
    failures: notices.failures + closed.failures,
  };
}

/** Job `monthly.check` (WP-021): mail mensile per gli "aperti", pausa dopo 6 mail senza risposta. */
export function sendMonthlyCheckEmails(): Promise<MonthlySummary> {
  return sendMonthlyChecks(outcomeRuntimeDeps());
}
