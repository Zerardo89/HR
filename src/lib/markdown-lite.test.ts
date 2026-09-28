import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdownLite } from "./markdown-lite";

describe("markdown ridotto dei testi legali", () => {
  it("titoli con ancora, paragrafi su più righe, elenchi con voci a capo", () => {
    const blocks = parseMarkdownLite(`# Condizioni

Primo paragrafo
che continua.

## Regolamento annunci {#regolamento-annunci}

- stipendio sempre
  indicato
- scadenza
Dopo l'elenco.`);
    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "Condizioni" },
      { kind: "paragraph", content: [{ kind: "text", text: "Primo paragrafo che continua." }] },
      { kind: "heading", level: 2, id: "regolamento-annunci", text: "Regolamento annunci" },
      {
        kind: "list",
        items: [
          [{ kind: "text", text: "stipendio sempre indicato" }],
          [{ kind: "text", text: "scadenza" }],
        ],
      },
      { kind: "paragraph", content: [{ kind: "text", text: "Dopo l'elenco." }] },
    ]);
  });

  it("solo link interni; quelli esterni restano testo; nessun HTML", () => {
    expect(parseInline("Vedi [segnalazioni](/segnalazioni) e [qui](https://example.com).")).toEqual(
      [
        { kind: "text", text: "Vedi " },
        { kind: "link", text: "segnalazioni", href: "/segnalazioni" },
        { kind: "text", text: " e " },
        { kind: "text", text: "qui" },
        { kind: "text", text: "." },
      ],
    );
    expect(parseInline("è **gratuito, sempre**.")).toEqual([
      { kind: "text", text: "è " },
      { kind: "strong", text: "gratuito, sempre" },
      { kind: "text", text: "." },
    ]);
    expect(parseMarkdownLite("<script>alert(1)</script>")).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "<script>alert(1)</script>" }] },
    ]);
  });
});
