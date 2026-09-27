import "server-only";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { isTokenShape } from "@/lib/tokens";

/*
 * Invito in sospeso durante l'accesso (WP-011c): chi apre il link senza essere entrato lo ritrova nell'area
 * azienda dopo il codice email (e la 2FA). Cookie tecnico `HttpOnly`, 1 giorno; contiene solo il token.
 */
const MAX_AGE_S = 24 * 60 * 60;

function secure(): boolean {
  return getServerEnv().APP_URL.startsWith("https://");
}

function name(): string {
  return secure() ? "__Host-invito" : "invito";
}

function options(maxAge: number) {
  return { httpOnly: true, secure: secure(), sameSite: "lax" as const, path: "/", maxAge };
}

export async function readPendingInvite(): Promise<string | null> {
  const value = (await cookies()).get(name())?.value;
  return isTokenShape(value) ? value : null;
}

export async function setPendingInvite(token: string): Promise<void> {
  (await cookies()).set(name(), token, options(MAX_AGE_S));
}

export async function clearPendingInvite(): Promise<void> {
  (await cookies()).set(name(), "", options(0));
}
