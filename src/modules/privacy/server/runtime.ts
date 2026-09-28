import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import { fileErasureLedger, type ErasureLedger } from "./ledger";
import type { RetentionDeps } from "./retention";
import type { PrivacyDeps } from "./worker-pii";

export function runtimeDeps(): PrivacyDeps & { ledger?: ErasureLedger } {
  const ledgerFile = getServerEnv().ERASURE_LEDGER_FILE;
  return {
    db: getDb(),
    keys: getKeyProvider(),
    now: () => new Date(),
    ...(ledgerFile ? { ledger: fileErasureLedger(ledgerFile) } : {}),
  };
}

export function retentionRuntimeDeps(): RetentionDeps {
  return { ...runtimeDeps(), mailer: getMailer(), appUrl: getServerEnv().APP_URL };
}
