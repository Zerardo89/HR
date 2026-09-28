/**
 * Header di sicurezza (WP-027, docs/04 §6). Funzioni pure: le usano `next.config.ts` (header fissi, su tutte le
 * risposte, API comprese) e `src/proxy.ts` (CSP con nonce, solo sulle pagine).
 *
 * - CSP "stretta" con nonce per richiesta e `strict-dynamic` (guida Next.js 16, content-security-policy.md):
 *   nessuno script inline senza nonce, nessuna origine esterna. Pubblicità (WP-025) e analisi (Umami) dovranno
 *   aggiungere qui le loro origini, dietro i rispettivi flag.
 * - `Referrer-Policy: same-origin`: gli indirizzi con token delle email (disiscrizione, mail mensile, inviti) non
 *   escono mai verso altri siti. Non `no-referrer`: toglierebbe l'`Origin` ai POST dei form, che Next.js usa
 *   contro il CSRF delle Server Actions.
 */

export type HeaderPair = readonly [name: string, value: string];

/** Su tutte le risposte (anche API e file statici). HSTS lo mette anche Caddy, che termina il TLS. */
export const STATIC_SECURITY_HEADERS: readonly HeaderPair[] = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "same-origin"],
  ["X-Frame-Options", "DENY"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  ],
];

export const HSTS: HeaderPair = ["Strict-Transport-Security", "max-age=31536000"];

export function contentSecurityPolicy(
  nonce: string,
  options: { dev: boolean; https: boolean },
): string {
  const directives = [
    "default-src 'self'",
    // In sviluppo React usa `eval` per gli stack degli errori; in produzione no.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Solo in HTTPS: in locale (http://localhost) romperebbe il caricamento delle risorse.
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

/** Nonce imprevedibile per ogni richiesta (128 bit, base64). */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
