import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_MAX_AGE_S, sessionCookieName, signupCookieName } from "../domain";
import { secureCookies } from "./runtime";

/** Cookie tecnici (nessun consenso necessario): `HttpOnly`, `SameSite=Lax`, `Secure` in HTTPS. */
function options(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(sessionCookieName(secureCookies()))?.value ?? null;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(
    sessionCookieName(secureCookies()),
    token,
    options(SESSION_COOKIE_MAX_AGE_S),
  );
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(sessionCookieName(secureCookies()), "", options(0));
}

export async function readSignupTicket(): Promise<string | null> {
  return (await cookies()).get(signupCookieName(secureCookies()))?.value ?? null;
}

export async function setSignupTicket(ticket: string, expiresAt: Date): Promise<void> {
  const seconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  (await cookies()).set(signupCookieName(secureCookies()), ticket, options(seconds));
}

export async function clearSignupTicket(): Promise<void> {
  (await cookies()).set(signupCookieName(secureCookies()), "", options(0));
}
