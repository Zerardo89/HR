import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import type { ProfileDeps } from "./profile";

export function runtimeDeps(): ProfileDeps {
  return { db: getDb(), keys: getKeyProvider(), now: () => new Date() };
}
