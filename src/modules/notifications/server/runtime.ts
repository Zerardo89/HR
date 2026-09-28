import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import type { OutcomeDeps } from "./outcomes";
import type { AlertDeps } from "./saved-searches";

export function runtimeDeps(): AlertDeps {
  return { db: getDb(), now: () => new Date() };
}

export function outcomeRuntimeDeps(): OutcomeDeps {
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
  };
}
