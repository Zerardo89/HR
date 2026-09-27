import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import { MemoryLimiter } from "@/modules/identity/domain";
import { WAITLIST_IP_LIMIT } from "../domain";
import type { WaitlistDeps } from "./deps";

export function runtimeDeps(): WaitlistDeps {
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
  };
}

const store = globalThis as typeof globalThis & { __hrWaitlistLimiter?: MemoryLimiter };

export function ipLimiter(): MemoryLimiter {
  store.__hrWaitlistLimiter ??= new MemoryLimiter(WAITLIST_IP_LIMIT);
  return store.__hrWaitlistLimiter;
}
