import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  offlinePageHtml,
  serviceWorkerSource,
  UNREACHABLE_STATUSES,
} from "./service-worker";

// Test di accettazione WP-010: service worker senza cache e pagine offline.

const texts = {
  siteName: "Esempio",
  offline: { title: "Sei offline", text: "Controlla <la rete> & riprova", retry: "Riprova" },
  unavailable: { title: "Servizio non raggiungibile", text: "Riprova più tardi", retry: "Riprova" },
  colors: { background: "#fff", foreground: "#000", primary: "#3f6b52", primaryForeground: "#fff" },
};

describe("service worker", () => {
  const source = serviceWorkerSource(texts);

  it("non salva niente sul telefono (docs/04: nessun dato personale in cache)", () => {
    expect(source).not.toMatch(/caches|indexedDB|localStorage|cache\.put/);
  });

  it("tocca solo le navigazioni GET: form, API e Server Actions passano dirette", () => {
    expect(source).toContain('request.mode !== "navigate" || request.method !== "GET"');
  });

  it("è JavaScript valido e contiene le due pagine", () => {
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain("Sei offline");
    expect(source).toContain("Servizio non raggiungibile");
  });

  it("server di casa spento (ADR-0012): gli errori di Cloudflare mostrano la pagina, i 500 dell'app no", () => {
    expect(UNREACHABLE_STATUSES).toEqual(expect.arrayContaining([502, 503, 504, 521, 522, 530]));
    expect(UNREACHABLE_STATUSES).not.toContain(500);
  });
});

describe("pagina offline", () => {
  it("testi con caratteri speciali in sicurezza e link 'Riprova' senza JavaScript", () => {
    const html = offlinePageHtml(texts.offline, texts.siteName, texts.colors);
    expect(html).toContain("Controlla &lt;la rete&gt; &amp; riprova");
    expect(html).toContain('<a href="">Riprova</a>');
    expect(html).not.toContain("<script");
    expect(html).toContain('lang="it"');
  });

  it("escapeHtml copre anche gli apici", () => {
    expect(escapeHtml(`"'`)).toBe("&quot;&#39;");
  });
});
