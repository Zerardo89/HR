import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { decryptPii, dekContextFor, type AuditSink } from "@/lib/crypto";
import { users } from "@/lib/db/schema";
import { dbAuditSink } from "./audit";
import type { PrivacyDeps } from "./worker-pii";

/*
 * Indirizzo email per le comunicazioni di servizio chieste dall'utente (WP-020). La lettura è registrata come
 * `system:notify` con lo scopo della comunicazione; gli scopi ammessi sono solo questi.
 */

export const NOTIFICATION_PURPOSES = ["notification.job-alert"] as const;
export type NotificationPurpose = (typeof NOTIFICATION_PURPOSES)[number];

/** Email di un utente attivo (`null` se l'account non è attivo o la chiave è stata distrutta). */
export async function notificationEmail(
  deps: PrivacyDeps,
  userId: string,
  purpose: NotificationPurpose,
  audit: AuditSink = dbAuditSink(deps.db, deps.now),
): Promise<string | null> {
  const [user] = await deps.db
    .select({ dekWrapped: users.dekWrapped, emailEnc: users.emailEnc })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .limit(1);
  if (!user?.dekWrapped) return null;
  return decryptPii({
    provider: deps.keys,
    audit,
    actorId: "system:notify",
    purpose,
    dekWrapped: user.dekWrapped,
    dekContext: dekContextFor("users", userId),
    token: user.emailEnc,
    location: { table: "users", column: "email_enc", rowId: userId },
    schema: z.string(),
  });
}
