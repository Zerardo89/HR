import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, HSTS, newNonce } from "@/lib/security-headers";
import { SESSION_COOKIE_MAX_AGE_S, sessionCookieName } from "@/modules/identity/domain";

/**
 * Proxy delle pagine (gira separato dal rendering: niente DB e niente moduli "server-only").
 * - CSP con un nonce nuovo a ogni pagina (WP-027): Next.js lo legge dall'header della richiesta e lo mette sui
 *   propri script. Le pagine sono già dinamiche (`force-dynamic` nel layout).
 * - Rinnovo scorrevole del cookie di sessione (ADR-0013): a ogni pagina visitata il cookie riparte da 30 giorni.
 *   Il cookie è solo il contenitore del token: la validità vera la decide la riga in `auth_sessions`.
 */
export function proxy(request: NextRequest) {
  if (request.method !== "GET") return NextResponse.next();

  const secure = (process.env.APP_URL ?? "").startsWith("https://");
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: secure,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (secure) response.headers.set(...HSTS);

  const name = sessionCookieName(secure);
  const token = request.cookies.get(name)?.value;
  if (token) {
    response.cookies.set(name, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_S,
    });
  }
  return response;
}

export const config = {
  // Solo le pagine: niente file statici, immagini, API, service worker e `.well-known` (WP-010); gli header fissi
  // li mette next.config.ts ovunque.
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|sw\\.js$|\\.well-known/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|webmanifest)$).*)",
  ],
};
