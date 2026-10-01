import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseMarkdownLite } from "@/lib/markdown-lite";
import { PRIVACY_VERSIONS } from "../../../../content/legal/privacy";
import { CURRENT_PRIVACY_NOTICE, privacyNoticeDocument } from "./privacy-notice";

// Test di accettazione WP-024c (art. 13 GDPR, docs/04 §1). NON modificarli per farli passare.

/**
 * Impronta di ogni versione pubblicata: chi l'ha letta alla registrazione deve poterla rileggere identica. Per
 * cambiare il testo si AGGIUNGE una versione (e la sua impronta qui), non si modifica una esistente.
 */
const PUBLISHED: Record<string, string> = {
  "bozza-2026-09-27": "a59e6e5c334bc0be76296200c69407fe5d3b47664fc72541ef18da36649f8e74",
  "bozza-2026-10-01": "befc0758d9fafad848e7defc9db60119edeff0e98a2278c1cffd371b196af3ad",
};

/** La sola frase sulla cifratura che si può usare in pubblico (docs/04 §1). */
const APPROVED_CLAIM =
  "I tuoi dati personali sono cifrati nel database. Nemmeno chi gestisce la piattaforma li vede durante il lavoro quotidiano: l'app li decifra solo quando servono a te o all'azienda a cui hai scelto di candidarti, e ogni accesso viene registrato.";

describe("informativa sulla privacy versionata", () => {
  it("le versioni pubblicate non cambiano", () => {
    for (const [id, hash] of Object.entries(PUBLISHED)) {
      const text = PRIVACY_VERSIONS[id]?.text ?? "";
      expect(createHash("sha256").update(text).digest("hex"), id).toBe(hash);
    }
    // Ogni versione nel file ha la sua impronta qui (si aggiunge, non si sostituisce).
    expect(Object.keys(PRIVACY_VERSIONS).sort()).toEqual(Object.keys(PUBLISHED).sort());
  });

  it("la versione in vigore è la più recente; le precedenti restano leggibili", () => {
    expect(privacyNoticeDocument.version()?.id).toBe(CURRENT_PRIVACY_NOTICE);
    expect(privacyNoticeDocument.history()[0]).toMatchObject({
      id: CURRENT_PRIVACY_NOTICE,
      current: true,
    });
    expect(privacyNoticeDocument.version("inesistente")).toBeNull();
    expect(privacyNoticeDocument.version("__proto__")).toBeNull();
  });

  it("usa solo la frase approvata sulla cifratura, senza promesse esagerate", () => {
    const text = privacyNoticeDocument.version()!.text;
    expect(text).toContain(APPROVED_CLAIM);
    expect(text).not.toMatch(/nessuno (può|potrà) (leggere|vedere|accedere)/i);
    expect(text).not.toMatch(/conoscenza zero|zero[- ]knowledge|impossibile (leggere|accedere)/i);
  });
});

describe("informativa completa (art. 13 GDPR)", () => {
  const current = privacyNoticeDocument.version()!;
  const complete = current.id !== "bozza-2026-09-27";

  it.runIf(complete)("ha tutte le sezioni richieste, con le ancore", () => {
    const anchors = parseMarkdownLite(current.text).flatMap((b) =>
      b.kind === "heading" && b.id ? [b.id] : [],
    );
    expect(anchors).toEqual(
      expect.arrayContaining([
        "titolare",
        "dati",
        "finalita",
        "sicurezza",
        "destinatari",
        "trasferimenti",
        "conservazione",
        "decisioni-automatizzate",
        "diritti",
        "cookie",
        "minori",
        "anteprima",
        "modifiche",
      ]),
    );
  });

  it.runIf(complete)(
    "dice le cose che il codice fa davvero (docs/02 §4, docs/04 §8, ADR-0012/0014)",
    () => {
      const text = current.text;
      // Basi giuridiche e norme citate.
      for (const ref of ["6.1.b", "6.1.f", "111-bis", "2022/2065", "art. 22", "12.3"]) {
        expect(text, ref).toContain(ref);
      }
      // Conservazione (R-PRIV-03) e copie di sicurezza (ADR-0014).
      for (const fact of ["6 mesi", "24 mesi", "30 giorni", "12 mesi", "al più entro 6 mesi"]) {
        expect(text, fact).toContain(fact);
      }
      // Fornitori e trasferimenti (R-PRIV-08, ADR-0012).
      for (const who of [
        "Cloudflare",
        "Brevo",
        "R2",
        "VIES",
        "Data Privacy Framework",
        "titolare autonomo",
      ]) {
        expect(text, who).toContain(who);
      }
      expect(text).toContain("www.garanteprivacy.it");
      // Il sito oggi NON raccoglie categorie protette o dati sulla salute (lo schema c'è, la funzione no).
      expect(text).toMatch(/non raccogliamo[^.]*categorie protette[^.]*salute/i);
      // Niente date di nascita o foto, mai.
      expect(text).toMatch(/data di nascita/);
    },
  );

  it.runIf(complete)("nessun link esterno nel testo (solo pagine del sito)", () => {
    expect(current.text).not.toMatch(/\]\(https?:/);
  });
});
