/**
 * Registro delle cancellazioni (ADR-0014, WP-027): dopo un ripristino da backup si ripetono le cancellazioni
 * avvenute dopo la data del backup. Ogni riga è JSON con il solo id (pseudonimo), come l'evento del log applicativo:
 * lo stesso lettore accetta sia il registro dedicato sia le righe del log di pino.
 */

export const ERASURE_EVENT = "account.erased";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function erasureLedgerLine(userId: string, at: Date): string {
  return `${JSON.stringify({ at: at.toISOString(), event: ERASURE_EVENT, userId })}\n`;
}

/** Id degli account cancellati trovati nel testo (una riga JSON per evento), senza doppioni, nell'ordine. */
export function parseErasedUserIds(text: string): string[] {
  const ids = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.includes(ERASURE_EVENT)) continue;
    try {
      const entry = JSON.parse(line) as { event?: unknown; userId?: unknown };
      if (
        entry.event === ERASURE_EVENT &&
        typeof entry.userId === "string" &&
        UUID.test(entry.userId)
      ) {
        ids.add(entry.userId);
      }
    } catch {
      // Righe non JSON (log di altri programmi, righe tagliate): si saltano.
    }
  }
  return [...ids];
}
