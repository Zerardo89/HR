import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import { MemoryLimiter } from "@/modules/identity/domain";
import { REPORT_IP_LIMIT } from "../domain";
import type { TrustDeps } from "./reports";

export function runtimeDeps(): TrustDeps {
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
  };
}

const store = globalThis as typeof globalThis & { __hrReportLimiter?: MemoryLimiter };

export function reportLimiter(): MemoryLimiter {
  store.__hrReportLimiter ??= new MemoryLimiter(REPORT_IP_LIMIT);
  return store.__hrReportLimiter;
}
