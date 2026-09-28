import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { consents } from "@/lib/db/schema";

export type ConsentRow = {
  type: string;
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
};

/** Consensi e prese visione registrati (WP-023): cosa, quale versione del testo, quando. */
export function listConsents(db: NodePgDatabase, userId: string): Promise<ConsentRow[]> {
  return db
    .select({
      type: consents.type,
      version: consents.version,
      grantedAt: consents.grantedAt,
      revokedAt: consents.revokedAt,
    })
    .from(consents)
    .where(eq(consents.userId, userId))
    .orderBy(asc(consents.grantedAt));
}
