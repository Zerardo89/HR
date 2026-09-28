import { and, asc, eq, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  applications,
  auditLog,
  authRecoveryCodes,
  authSessions,
  companyMembers,
  contactRequests,
  emailActionTokens,
  savedSearches,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { ErasureLedger } from "./ledger";

/*
 * Cancellazione dell'account con crypto-shredding (WP-023, R-PRIV-04, docs/04 §3).
 * - La DEK dell'utente si distrugge: tutto ciò che era cifrato con lei (email, profilo, messaggi) diventa subito
 *   illeggibile. Nei backup resta la DEK cifrata fino alla loro rotazione (≤ 6 mesi): ADR-0014. Per ripetere la
 *   cancellazione dopo un ripristino, il log applicativo registra l'evento `account.erased` con il solo id.
 * - Si cancellano profilo, candidature, avvisi, sessioni, token, appartenenze alle aziende.
 * - Resta una "lapide" senza dati personali (id, stato `deleted`, data): non si riusa l'id, i consensi dati restano
 *   come prova (senza dati personali) e il log di audit (append-only) resta coerente.
 * - L'email si libera: ci si può registrare di nuovo con lo stesso indirizzo (nuovo account, nuova chiave).
 * - Unico titolare di un'azienda con colleghi: la titolarità passa al collega attivo più anziano, così l'azienda
 *   non resta senza responsabile (registrato nell'audit).
 * - Oltre al log, il registro delle cancellazioni (`ERASURE_LEDGER_FILE`, WP-027) tiene l'id fuori dal DB: dopo un
 *   ripristino da backup `reapplyErasures` ripete le cancellazioni (motivo `restore`, runbook).
 */

export type ErasureReason = "self" | "retention" | "restore";
export type ErasureResult = { status: "deleted" | "not_found" };

export async function eraseAccount(
  deps: { db: NodePgDatabase; now: () => Date; ledger?: ErasureLedger },
  userId: string,
  reason: ErasureReason,
): Promise<ErasureResult> {
  const now = deps.now();
  return deps.db
    .transaction(async (tx) => {
      const [user] = await tx
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1);
      if (!user || user.status === "deleted") return { status: "not_found" as const };

      const owned = await tx
        .select({ companyId: companyMembers.companyId })
        .from(companyMembers)
        .where(and(eq(companyMembers.userId, userId), eq(companyMembers.role, "owner")));
      for (const { companyId } of owned) {
        const [otherOwner] = await tx
          .select({ userId: companyMembers.userId })
          .from(companyMembers)
          .innerJoin(users, eq(users.id, companyMembers.userId))
          .where(
            and(
              eq(companyMembers.companyId, companyId),
              eq(companyMembers.role, "owner"),
              ne(companyMembers.userId, userId),
              eq(users.status, "active"),
            ),
          )
          .limit(1);
        if (otherOwner) continue;
        const [heir] = await tx
          .select({ userId: companyMembers.userId })
          .from(companyMembers)
          .innerJoin(users, eq(users.id, companyMembers.userId))
          .where(
            and(
              eq(companyMembers.companyId, companyId),
              ne(companyMembers.userId, userId),
              eq(users.status, "active"),
            ),
          )
          .orderBy(asc(companyMembers.createdAt))
          .limit(1);
        if (!heir) continue;
        await tx
          .update(companyMembers)
          .set({ role: "owner" })
          .where(
            and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, heir.userId)),
          );
        await tx.insert(auditLog).values({
          actorId: "system:erasure",
          action: "company.owner_transfer",
          targetTable: "companies",
          targetId: companyId,
          at: now,
        });
      }

      await tx.delete(companyMembers).where(eq(companyMembers.userId, userId));
      await tx.delete(applications).where(eq(applications.workerUserId, userId));
      await tx.delete(contactRequests).where(eq(contactRequests.workerUserId, userId));
      await tx.delete(savedSearches).where(eq(savedSearches.userId, userId));
      await tx.delete(workerProfiles).where(eq(workerProfiles.userId, userId));
      await tx.delete(emailActionTokens).where(eq(emailActionTokens.userId, userId));
      await tx.delete(authSessions).where(eq(authSessions.userId, userId));
      await tx.delete(authRecoveryCodes).where(eq(authRecoveryCodes.userId, userId));
      await tx
        .update(users)
        .set({
          status: "deleted",
          deletedAt: now,
          dekWrapped: null, // crypto-shredding
          emailBidx: `deleted:${userId}`,
          emailEnc: "",
          totpSecretEnc: null,
          totpEnabledAt: null,
          totpLastStep: null,
        })
        .where(eq(users.id, userId));
      await tx.insert(auditLog).values({
        actorId: reason === "self" ? userId : `system:${reason}`,
        action: "account.delete",
        targetTable: "users",
        targetId: userId,
        purpose: reason,
        at: now,
      });
      return { status: "deleted" as const };
    })
    .then(async (result) => {
      // Fuori dal DB (log applicativo e registro): serve a ripetere la cancellazione dopo un ripristino (ADR-0014).
      if (result.status === "deleted") {
        logger.info({ userId, event: "account.erased", reason }, "account cancellato");
        await deps.ledger?.(userId, now).catch((error: Error) => {
          // La cancellazione resta valida; resta la riga del log. Va sistemato: allarme a livello error.
          logger.error({ err: error.name, event: "erasure-ledger.failed" }, "registro non scritto");
        });
      }
      return result;
    });
}

/**
 * Dopo un ripristino da backup (runbook, ADR-0014): ripete le cancellazioni registrate. Chi è già cancellato nel
 * backup ripristinato si salta; un id sconosciuto (account creato dopo il backup e poi cancellato) pure.
 */
export async function reapplyErasures(
  deps: { db: NodePgDatabase; now: () => Date },
  userIds: readonly string[],
): Promise<{ erased: number; alreadyGone: number }> {
  let erased = 0;
  for (const id of userIds) {
    const result = await eraseAccount(deps, id, "restore");
    if (result.status === "deleted") erased += 1;
  }
  return { erased, alreadyGone: userIds.length - erased };
}
