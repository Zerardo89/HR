import "server-only";
import { getDb } from "@/lib/db";
import type { AlertDeps } from "./saved-searches";

export function runtimeDeps(): AlertDeps {
  return { db: getDb(), now: () => new Date() };
}
