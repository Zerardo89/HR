/**
 * Markdown ridotto per i testi legali in `content/` (WP-024b): titoli `#`/`##` (con ancora `{#id}` facoltativa),
 * paragrafi, elenchi `- `, grassetto `**…**` e link `[testo](/percorso)`. Niente HTML: si rende con componenti React, quindi il
 * testo non può iniettare codice. Link solo interni (`/…` o `#…`): i testi li scrive il team, non gli utenti.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 1 | 2; id?: string; text: string }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] };

const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const [whole, label, href, strong] = m;
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (strong !== undefined) out.push({ kind: "strong", text: strong });
    else if (href!.startsWith("/") || href!.startsWith("#")) {
      out.push({ kind: "link", text: label!, href: href! });
    } else out.push({ kind: "text", text: label! }); // link esterno: resta solo il testo
    last = at + whole.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function parseMarkdownLite(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: "list", items: list.map(parseInline) });
      list = null;
    }
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,2})\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1]!.length as 1 | 2,
        text: heading[2]!,
        ...(heading[3] ? { id: heading[3] } : {}),
      });
    } else if (line.startsWith("- ")) {
      if (paragraph.length) flush();
      list ??= [];
      list.push(line.slice(2).trim());
    } else if (line === "") {
      flush();
    } else if (list && raw.startsWith("  ")) {
      list[list.length - 1] += ` ${line}`; // seguito della voce precedente
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
