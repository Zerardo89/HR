import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import type { Mailer } from "@/lib/mail";

export type WaitlistDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
};
