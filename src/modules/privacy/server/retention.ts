import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fillTemplate, messages } from "@/i18n/messages";
import type { KeyProvider } from "@/lib/crypto";
import { auditLog, users, waitlist, workerProfiles } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import {
  AUDIT_RETENTION_MONTHS,
  canDeleteInactive,
  DELETE_NOTICE_MONTHS,
  INACTIVE_HIDE_MONTHS,
  monthsBefore,
  scheduledDeletion,
  waitlistExpired,
} from "../domain";
import { eraseAccount } from "./erasure";
import type { ErasureLedger } from "./ledger";
import { notificationEmail } from "./notify";

/*
 * Job di conservazione (R-PRIV-03, docs/04 §8, WP-023b). Tutti ripetibili: rifarli non cambia nulla.
 * "Attività" = ultimo accesso all'account o ultima interazione col profilo (risposta alla mail mensile, salvataggio).
 * Personale (moderatori, amministratori) escluso dalla cancellazione per inattività.
 */

export type RetentionDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
  /** Registro delle cancellazioni fuori dal DB (ADR-0014). */
  ledger?: ErasureLedger;
};

const BATCH = 500;
const longDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

function compose(appUrl: string, subject: string, body: string) {
  const c = messages.emails.common;
  return {
    subject,
    text: [
      c.intro,
      body,
      fillTemplate(c.signature, { siteName: messages.meta.siteName, appUrl }),
    ].join("\n\n"),
  };
}

async function tell(deps: RetentionDeps, userId: string, email: { subject: string; text: string }) {
  try {
    const to = await notificationEmail(deps, userId, "notification.retention");
    if (to) await deps.mailer.send({ to, ...email });
  } catch (error) {
    // L'azione di conservazione vale comunque; l'avviso è di cortesia.
    logger.warn({ err: (error as Error).name }, "avviso di conservazione non spedito");
  }
}

/** 6 mesi senza attività → profilo nascosto e email sospese, con un avviso. */
export async function hideInactiveProfiles(
  deps: RetentionDeps,
): Promise<{ profilesHidden: number }> {
  const now = deps.now();
  const limit = monthsBefore(now, INACTIVE_HIDE_MONTHS);
  const rows = await deps.db
    .select({ userId: workerProfiles.userId })
    .from(workerProfiles)
    .innerJoin(users, eq(users.id, workerProfiles.userId))
    .where(
      and(
        sql`${workerProfiles.state} <> 'hidden'`,
        eq(users.status, "active"),
        lt(users.lastActiveAt, limit),
        lt(workerProfiles.lastInteractionAt, limit),
      ),
    )
    .limit(BATCH);
  const t = messages.emails.inactiveHidden;
  for (const { userId } of rows) {
    await deps.db
      .update(workerProfiles)
      .set({ state: "hidden", monthlyCheckOptIn: false, nextCheckAt: null, updatedAt: now })
      .where(eq(workerProfiles.userId, userId));
    await tell(
      deps,
      userId,
      compose(deps.appUrl, t.subject, fillTemplate(t.body, { link: `${deps.appUrl}/profilo` })),
    );
  }
  return { profilesHidden: rows.length };
}

/** 23 mesi senza accesso → preavviso di cancellazione (una volta; decade se l'utente torna). */
export async function sendDeletionNotices(
  deps: RetentionDeps,
): Promise<{ deletionNotices: number }> {
  const now = deps.now();
  // Chi è tornato dopo il preavviso non rischia più nulla.
  await deps.db
    .update(users)
    .set({ deletionNoticeAt: null })
    .where(and(isNotNull(users.deletionNoticeAt), gt(users.lastActiveAt, users.deletionNoticeAt)));
  const rows = await deps.db
    .select({ id: users.id, lastActiveAt: users.lastActiveAt })
    .from(users)
    .where(
      and(
        eq(users.status, "active"),
        inArray(users.role, ["worker", "company_member"]),
        lte(users.lastActiveAt, monthsBefore(now, DELETE_NOTICE_MONTHS)),
        isNull(users.deletionNoticeAt),
      ),
    )
    .limit(BATCH);
  const t = messages.emails.deletionNotice;
  for (const { id, lastActiveAt } of rows) {
    const date = longDate.format(scheduledDeletion(lastActiveAt, now));
    await deps.db.update(users).set({ deletionNoticeAt: now }).where(eq(users.id, id));
    await tell(
      deps,
      id,
      compose(
        deps.appUrl,
        fillTemplate(t.subject, { date }),
        fillTemplate(t.body, { date, link: `${deps.appUrl}/accedi` }),
      ),
    );
  }
  return { deletionNotices: rows.length };
}

/** 24 mesi senza accesso e preavviso di almeno 30 giorni → cancellazione con crypto-shredding. */
export async function deleteInactiveAccounts(
  deps: RetentionDeps,
): Promise<{ accountsDeleted: number }> {
  const now = deps.now();
  const rows = await deps.db
    .select({
      id: users.id,
      lastActiveAt: users.lastActiveAt,
      deletionNoticeAt: users.deletionNoticeAt,
    })
    .from(users)
    .where(
      and(
        eq(users.status, "active"),
        inArray(users.role, ["worker", "company_member"]),
        isNotNull(users.deletionNoticeAt),
      ),
    )
    .limit(BATCH);
  let deleted = 0;
  for (const u of rows) {
    if (!canDeleteInactive(u.lastActiveAt, u.deletionNoticeAt, now)) continue;
    const result = await eraseAccount(deps, u.id, "retention");
    if (result.status === "deleted") deleted += 1;
  }
  return { accountsDeleted: deleted };
}

/** Log di sicurezza oltre i 12 mesi (il trigger di `audit_log` ammette solo questa cancellazione). */
export async function purgeOldAuditLog(
  db: NodePgDatabase,
  now: Date,
): Promise<{ auditRowsDeleted: number }> {
  // Anche la soglia del DB (quella del trigger): se l'orologio del worker è avanti di qualche secondo, una riga
  // al confine farebbe fallire l'intera cancellazione.
  const deleted = await db
    .delete(auditLog)
    .where(
      and(
        lt(auditLog.at, monthsBefore(now, AUDIT_RETENTION_MONTHS)),
        sql`${auditLog.at} < now() - make_interval(months => ${AUDIT_RETENTION_MONTHS})`,
      ),
    )
    .returning({ id: auditLog.id });
  return { auditRowsDeleted: deleted.length };
}

/** Lista d'attesa: chi si è registrato esce subito; dopo 6 mesi dal lancio escono tutti. */
export async function purgeWaitlist(
  db: NodePgDatabase,
  now: Date,
): Promise<{ waitlistDeleted: number }> {
  const deleted = waitlistExpired(now)
    ? await db.delete(waitlist).returning({ id: waitlist.id })
    : await db
        .delete(waitlist)
        .where(inArray(waitlist.emailBidx, db.select({ bidx: users.emailBidx }).from(users)))
        .returning({ id: waitlist.id });
  return { waitlistDeleted: deleted.length };
}
