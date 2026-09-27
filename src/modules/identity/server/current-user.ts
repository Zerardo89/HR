import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "../domain";
import { readSessionToken } from "./cookies";
import { runtimeDeps } from "./runtime";
import { validateSessionToken, type SessionUser } from "./sessions";

/** Utente della richiesta corrente (una sola query per richiesta grazie a `cache`). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const result = await validateSessionToken(runtimeDeps(), token);
  return result?.user ?? null;
});

/**
 * Autorizzazione lato server (CLAUDE.md): ogni pagina o azione riservata la chiama.
 * Senza accesso → pagina di accesso; ruolo non ammesso → home.
 */
export async function requireUser(roles?: readonly UserRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/accedi");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}
