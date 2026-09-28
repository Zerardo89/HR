import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import type { PrivacyDeps } from "./worker-pii";

export function runtimeDeps(): PrivacyDeps {
  return { db: getDb(), keys: getKeyProvider(), now: () => new Date() };
}
