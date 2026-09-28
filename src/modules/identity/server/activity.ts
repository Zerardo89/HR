import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { users } from "@/lib/db/schema";

/**
 * Attività per le regole di conservazione (R-PRIV-03: "nessun accesso/clic"). L'accesso la registra da sé
 * (sessioni); questa serve ai clic dalle email che non passano dall'accesso, come la risposta alla mail mensile.
 */
export async function recordActivity(
  db: Pick<NodePgDatabase, "update">,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(users)
    .set({ lastActiveAt: now })
    .where(and(eq(users.id, userId), eq(users.status, "active")));
}
