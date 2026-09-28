import { appendFile } from "node:fs/promises";
import { erasureLedgerLine } from "../domain";

/** Scrive nel registro delle cancellazioni (ADR-0014): una riga per account, fuori dal DB. */
export type ErasureLedger = (userId: string, at: Date) => Promise<void>;

/**
 * Registro su file (in produzione su un volume del server, incluso nei backup ma separato dal DB). Solo il
 * processo dell'app lo legge e scrive (permessi 600).
 */
export function fileErasureLedger(path: string): ErasureLedger {
  return (userId, at) => appendFile(path, erasureLedgerLine(userId, at), { mode: 0o600 });
}
