import { and, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog, emailActionTokens, savedSearches } from "@/lib/db/schema";
import { hashToken, isTokenShape, newToken } from "@/lib/tokens";
import { UNSUBSCRIBE_TOKEN_DAYS } from "../domain";
import { revokeAlertsConsent, type AlertDeps } from "./saved-searches";

/*
 * Disiscrizione dagli avvisi (WP-020, R-MAIL-01, RFC 8058). Ogni email di avviso ha il suo token (nel DB solo
 * l'hash). Il POST "un clic" del programma di posta e il pulsante della pagina di conferma chiamano la stessa
 * funzione; aprire il link (GET) non cambia nulla (R-MAIL-02). Rifarla è innocuo.
 */

export async function createUnsubscribeToken(
  db: Pick<NodePgDatabase, "insert">,
  userId: string,
  now: Date,
): Promise<string> {
  const token = newToken();
  await db.insert(emailActionTokens).values({
    tokenHash: hashToken(token),
    userId,
    action: "unsubscribe",
    expiresAt: new Date(now.getTime() + UNSUBSCRIBE_TOKEN_DAYS * 24 * 60 * 60_000),
    createdAt: now,
  });
  return token;
}

async function findToken(deps: AlertDeps, token: unknown) {
  if (!isTokenShape(token)) return null;
  const [row] = await deps.db
    .select({ userId: emailActionTokens.userId, usedAt: emailActionTokens.usedAt })
    .from(emailActionTokens)
    .where(
      and(
        eq(emailActionTokens.tokenHash, hashToken(token)),
        eq(emailActionTokens.action, "unsubscribe"),
        gt(emailActionTokens.expiresAt, deps.now()),
      ),
    )
    .limit(1);
  return row?.userId ? { userId: row.userId, used: row.usedAt !== null } : null;
}

/** Per la pagina di conferma: il link è valido? È già stato usato? */
export async function checkUnsubscribeToken(
  deps: AlertDeps,
  token: unknown,
): Promise<"valid" | "used" | "invalid"> {
  const row = await findToken(deps, token);
  if (!row) return "invalid";
  return row.used ? "used" : "valid";
}

/** Toglie TUTTI gli avvisi della persona e chiude il consenso: chi si disiscrive non riceve più nulla. */
export async function unsubscribeWithToken(
  deps: AlertDeps,
  token: unknown,
): Promise<{ status: "done" | "invalid" }> {
  const row = await findToken(deps, token);
  if (!row || !isTokenShape(token)) return { status: "invalid" };
  const now = deps.now();
  await deps.db.transaction(async (tx) => {
    await tx.delete(savedSearches).where(eq(savedSearches.userId, row.userId));
    await revokeAlertsConsent(tx, row.userId, now);
    await tx
      .update(emailActionTokens)
      .set({ usedAt: now })
      .where(eq(emailActionTokens.tokenHash, hashToken(token)));
    if (!row.used) {
      await tx.insert(auditLog).values({
        actorId: row.userId,
        action: "alerts.unsubscribe",
        targetTable: "saved_searches",
        at: now,
      });
    }
  });
  return { status: "done" };
}
