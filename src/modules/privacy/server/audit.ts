import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AuditEvent, AuditSink } from "@/lib/crypto";
import { auditLog } from "@/lib/db/schema";

/** Registro di audit nel DB (append-only, ADR-0004): ogni decifratura lascia una riga PRIMA di avvenire. */
export function dbAuditSink(db: NodePgDatabase, now: () => Date): AuditSink {
  return {
    async record(event: AuditEvent) {
      await db.insert(auditLog).values({
        actorId: event.actorId,
        action: event.action,
        targetTable: event.targetTable,
        targetId: event.targetId,
        purpose: event.purpose,
        at: now(),
      });
    },
  };
}
