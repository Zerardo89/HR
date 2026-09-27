import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getMailer } from "@/lib/mail";
import type { CompanyDeps } from "./deps";
import type { InviteDeps } from "./invites";
import { createViesClient } from "./vies-client";

export function runtimeDeps(): CompanyDeps {
  return {
    db: getDb(),
    now: () => new Date(),
    vies: createViesClient(getServerEnv().VIES_API_URL),
  };
}

export function inviteRuntimeDeps(): InviteDeps {
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: getServerEnv().APP_URL,
  };
}
