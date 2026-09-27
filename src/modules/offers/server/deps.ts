import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type OfferDeps = { db: NodePgDatabase; now: () => Date };
