import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMarkdownLite } from "@/lib/markdown-lite";
import { TERMS_VERSIONS } from "../../../../content/legal/condizioni";
import { CURRENT_TERMS, termsHistory, termsOutdated, termsVersion } from "./terms";

// Test di accettazione WP-024b (R-DSA-02, DSA art. 14). NON modificarli per farli passare.

/**
 * Impronta di ogni versione pubblicata: chi l'ha accettata deve poterla rileggere identica. Per cambiare il
 * testo si AGGIUNGE una versione (e la sua impronta qui), non si modifica una esistente.
 */
const PUBLISHED: Record<string, string> = {
  "bozza-2026-09-27": "c7c1c8ec51fd5f532b678ad349dda60f9a472094ca625987245409b8b83c42fd",
  "bozza-2026-09-28": "1877bd00f11cd39716bbc81ecf9d350cd32607347cdac8a307d73014a0900455",
};

describe("condizioni d'uso versionate", () => {
  it("le versioni pubblicate non cambiano", () => {
    expect(Object.keys(TERMS_VERSIONS).sort()).toEqual(Object.keys(PUBLISHED).sort());
    for (const [id, hash] of Object.entries(PUBLISHED)) {
      const text = TERMS_VERSIONS[id]?.text ?? "";
      expect(createHash("sha256").update(text).digest("hex"), id).toBe(hash);
    }
  });

  it("la versione in vigore esiste, è la più recente e ha le sezioni richieste dal DSA", () => {
    const current = termsVersion();
    expect(current?.id).toBe(CURRENT_TERMS);
    expect(termsHistory()[0]).toMatchObject({ id: CURRENT_TERMS, current: true });
    const anchors = parseMarkdownLite(current!.text).flatMap((b) =>
      b.kind === "heading" && b.id ? [b.id] : [],
    );
    // Regolamento degli annunci (art. 14.1) e come moderiamo, compresi strumenti automatici e riesame.
    expect(anchors).toEqual(
      expect.arrayContaining(["regolamento-annunci", "moderazione", "modifiche"]),
    );
    expect(current!.text).toContain("non usiamo intelligenza artificiale");
    expect(current!.text).toContain("riesame entro 6 mesi");
  });

  it("le versioni precedenti restano leggibili; quelle inesistenti no", () => {
    expect(termsVersion("bozza-2026-09-27")).toMatchObject({ current: false });
    expect(termsVersion("inesistente")).toBeNull();
    expect(termsVersion("__proto__")).toBeNull();
  });

  it("si accetta di nuovo quando la versione in vigore è cambiata", () => {
    expect(termsOutdated(CURRENT_TERMS)).toBe(false);
    expect(termsOutdated("bozza-2026-09-27")).toBe(true);
    expect(termsOutdated(null)).toBe(true);
  });
});
