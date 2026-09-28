import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import type { ApplicationDeps } from "./applications";

export function runtimeDeps(): ApplicationDeps {
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
  };
}
