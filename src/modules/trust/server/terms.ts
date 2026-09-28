import { and, desc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { consents } from "@/lib/db/schema";
import { CURRENT_TERMS } from "../domain";

/** Ultima versione delle condizioni d'uso accettata dall'utente (`null` se nessuna). */
export async function acceptedTermsVersion(
  db: NodePgDatabase,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ version: consents.version })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.type, "terms"), isNull(consents.revokedAt)))
    .orderBy(desc(consents.grantedAt))
    .limit(1);
  return row?.version ?? null;
}

/**
 * Accettazione della versione in vigore (WP-024b): una riga in `consents`, come alla registrazione, così resta
 * la prova di cosa è stato accettato e quando. Ripetere non aggiunge righe.
 */
export async function acceptCurrentTerms(
  db: NodePgDatabase,
  userId: string,
  now: Date,
): Promise<void> {
  if ((await acceptedTermsVersion(db, userId)) === CURRENT_TERMS) return;
  await db
    .insert(consents)
    .values({ userId, type: "terms", version: CURRENT_TERMS, grantedAt: now });
}
