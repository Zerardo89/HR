import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_MAX_AGE_S, sessionCookieName } from "@/modules/identity/domain";

/**
 * Rinnovo scorrevole del cookie di sessione (ADR-0013): a ogni pagina visitata il cookie riparte da 30 giorni.
 * Il cookie è solo il contenitore del token: la validità vera la decide la riga in `auth_sessions`.
 * Qui niente DB e niente moduli "server-only" (il proxy gira separato dal rendering).
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.method !== "GET") return response;

  const secure = (process.env.APP_URL ?? "").startsWith("https://");
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
  // Solo le pagine: niente file statici, immagini e API.
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|webmanifest)$).*)",
  ],
};
