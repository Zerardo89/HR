import { describe, expect, it } from "vitest";
import { erasureLedgerLine, parseErasedUserIds } from "./erasure-log";

// Test di accettazione WP-027 (ADR-0014): ripetere le cancellazioni dopo un ripristino. NON modificarli.

const a = "0b0e2a4c-5d6f-4a1b-8c9d-0e1f2a3b4c5d";
const b = "1c1f3b5d-6e70-4b2c-9dae-1f203b4c5d6e";

describe("registro delle cancellazioni", () => {
  it("una riga JSON per cancellazione, con il solo id", () => {
    const line = erasureLedgerLine(a, new Date("2026-11-10T10:00:00Z"));
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual({
      at: "2026-11-10T10:00:00.000Z",
      event: "account.erased",
      userId: a,
    });
  });

  it("legge sia il registro sia il log di pino; salta il resto; niente doppioni", () => {
    const text = [
      erasureLedgerLine(a, new Date()).trim(),
      `{"level":30,"time":"2026-11-11T08:00:00Z","app":"hr","userId":"${b}","event":"account.erased","reason":"self","msg":"account cancellato"}`,
      `{"level":30,"app":"hr","userId":"${b}","event":"account.erased"}`,
      `{"level":30,"app":"hr","event":"job.done","msg":"account.erased non c'entra"}`,
      `{"event":"account.erased","userId":"non-un-id"}`,
      'riga tagliata {"event":"account.erased","user',
      "",
    ].join("\n");
    expect(parseErasedUserIds(text)).toEqual([a, b]);
  });
});
