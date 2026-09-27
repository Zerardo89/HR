import "server-only";
import { cookies } from "next/headers";
import {
  MFA_TICKET_TTL_MS,
  mfaCookieName,
  pendingSessionCookieName,
  SESSION_COOKIE_MAX_AGE_S,
  sessionCookieName,
  signupCookieName,
} from "../domain";
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

/** Biglietto del secondo fattore (WP-011b): 10 minuti, poi si ricomincia dall'email. */
export async function readMfaTicket(): Promise<string | null> {
  return (await cookies()).get(mfaCookieName(secureCookies()))?.value ?? null;
}

export async function setMfaTicket(ticket: string, expiresAt: Date): Promise<void> {
  const seconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  (await cookies()).set(mfaCookieName(secureCookies()), ticket, options(seconds));
}

export async function clearMfaTicket(): Promise<void> {
  (await cookies()).set(mfaCookieName(secureCookies()), "", options(0));
}

/**
 * Sessione appena nata all'attivazione della 2FA, in attesa che l'utente salvi i codici di recupero.
 * Non vale come sessione: se si impostasse subito il cookie vero, la pagina di accesso si ricaricherebbe
 * sull'account e i codici sparirebbero prima di essere letti.
 */
export async function readPendingSession(): Promise<string | null> {
  return (await cookies()).get(pendingSessionCookieName(secureCookies()))?.value ?? null;
}

export async function setPendingSession(token: string): Promise<void> {
  (await cookies()).set(
    pendingSessionCookieName(secureCookies()),
    token,
    options(MFA_TICKET_TTL_MS / 1000),
  );
}

export async function clearPendingSession(): Promise<void> {
  (await cookies()).set(pendingSessionCookieName(secureCookies()), "", options(0));
}
