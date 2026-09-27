import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ViesResult } from "../domain";

export interface ViesClient {
  check(vat: string): Promise<ViesResult>;
}

export type CompanyDeps = { db: NodePgDatabase; now: () => Date; vies: ViesClient };
