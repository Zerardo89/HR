import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import type { Mailer } from "@/lib/mail";

/** Dipendenze dei servizi di accesso: passate da fuori, così i test usano DB, chiavi e posta di prova. */
export type IdentityDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
  /** Anteprima (WP-010b): se presente, per registrarsi serve uno di questi codici. */
  previewInviteCodes?: readonly string[];
};
