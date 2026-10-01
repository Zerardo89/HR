/**
 * Service worker minimo dell'app (WP-010, ADR-0012). Funzioni pure: le usa la route `/sw.js`.
 *
 * - **Nessuna cache**: pagine e dati personali non restano salvati sul telefono (docs/04). Il service worker
 *   tocca solo le navigazioni GET: le richieste dell'app, i form e le Server Actions passano senza intermediari.
 * - Senza rete → pagina "Sei offline". Server non raggiungibile (ADR-0012: il computer di casa è spento e
 *   Cloudflare risponde 52x/530) → pagina "Servizio non raggiungibile". Le due pagine sono scritte qui dentro, con
 *   una CSP propria: niente script, solo stili inline.
 */

export type OfflinePage = { title: string; text: string; retry: string };

export type ServiceWorkerTexts = {
  siteName: string;
  offline: OfflinePage;
  unavailable: OfflinePage;
  colors: { background: string; foreground: string; primary: string; primaryForeground: string };
};

/** Risposte di Cloudflare e dei gateway quando dietro non risponde nessuno. Gli errori dell'app (500) restano. */
export const UNREACHABLE_STATUSES = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530];

export const OFFLINE_PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

export function offlinePageHtml(
  page: OfflinePage,
  siteName: string,
  colors: ServiceWorkerTexts["colors"],
): string {
  const e = escapeHtml;
  // "Riprova" è un link alla pagina stessa: funziona senza JavaScript.
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${e(page.title)} · ${e(siteName)}</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:${colors.background};color:${colors.foreground};font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:100%}main{max-width:28rem;padding:1.5rem}h1{color:${colors.primary};font-size:1.5rem}p{line-height:1.5}a{display:inline-block;margin-top:.5rem;padding:.75rem 1.25rem;border-radius:.5rem;background:${colors.primary};color:${colors.primaryForeground};font-weight:600;text-decoration:none}</style>
</head><body><main><p><strong>${e(siteName)}</strong></p><h1>${e(page.title)}</h1><p>${e(page.text)}</p><a href="">${e(page.retry)}</a></main></body></html>`;
}

export function serviceWorkerSource(texts: ServiceWorkerTexts): string {
  const offline = offlinePageHtml(texts.offline, texts.siteName, texts.colors);
  const unavailable = offlinePageHtml(texts.unavailable, texts.siteName, texts.colors);
  return `// ${texts.siteName}: service worker minimo (WP-010). Nessuna cache: vedi src/lib/pwa/service-worker.ts.
const OFFLINE_PAGE = ${JSON.stringify(offline)};
const UNAVAILABLE_PAGE = ${JSON.stringify(unavailable)};
const UNREACHABLE = new Set(${JSON.stringify(UNREACHABLE_STATUSES)});
const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": ${JSON.stringify(OFFLINE_PAGE_CSP)},
  "Cache-Control": "no-store",
};

function page(html) {
  return new Response(html, { status: 200, headers: PAGE_HEADERS });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).then(
      (response) => (UNREACHABLE.has(response.status) ? page(UNAVAILABLE_PAGE) : response),
      () => page(OFFLINE_PAGE),
    ),
  );
});
`;
}
