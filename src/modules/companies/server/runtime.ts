import "server-only";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { CompanyDeps } from "./deps";
import { createViesClient } from "./vies-client";

export function runtimeDeps(): CompanyDeps {
  return {
    db: getDb(),
    now: () => new Date(),
    vies: createViesClient(getServerEnv().VIES_API_URL),
  };
}
