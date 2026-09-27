import { and, eq, lt } from "drizzle-orm";
import {
  auditLog,
  authMfaTickets,
  authOtpChallenges,
  authSessions,
  authSignupTickets,
  users,
} from "@/lib/db/schema";
import { isPrivilegedRole, renewedSessionExpiry, sessionExpiresAt, type UserRole } from "../domain";
import type { IdentityDeps } from "./deps";
import { hashToken, newToken } from "./tokens";

export type NewSession = { token: string; expiresAt: Date };
export type SessionUser = { id: string; role: UserRole };

type Deps = Pick<IdentityDeps, "db" | "now">;

export async function createSession(
  deps: Deps,
  userId: string,
  role: UserRole,
): Promise<NewSession> {
  const now = deps.now();
  const token = newToken();
  const expiresAt = sessionExpiresAt(role, now);
  await deps.db
    .insert(authSessions)
    .values({ id: hashToken(token), userId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

export type SignedIn = { status: "signed_in"; userId: string; role: UserRole; session: NewSession };

/**
 * Ultimo passo dell'accesso, a fattori già controllati: sessione, attività e, per moderatori e admin,
 * la riga di audit (docs/04 §7) con l'IP pseudonimizzato.
 */
export async function finishSignIn(
  deps: Pick<IdentityDeps, "db" | "now" | "keys">,
  user: SessionUser,
  ip: string | null,
): Promise<SignedIn> {
  const now = deps.now();
  const session = await createSession(deps, user.id, user.role);
  await deps.db.update(users).set({ lastActiveAt: now }).where(eq(users.id, user.id));
  if (isPrivilegedRole(user.role)) {
    await deps.db.insert(auditLog).values({
      actorId: user.id,
      action: "auth.login",
      targetTable: "users",
      targetId: user.id,
      ipHash: ip ? await deps.keys.mac(ip, "ip") : null,
      at: now,
    });
  }
  return { status: "signed_in", userId: user.id, role: user.role, session };
}

/**
 * Il token del cookie è valido se: la sessione esiste, non è scaduta, l'utente è attivo.
 * Rinnovo scorrevole per lavoratori e aziende (ADR-0013); una sessione scaduta viene cancellata.
 */
export async function validateSessionToken(
  deps: Deps,
  token: string,
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
  if (token.length === 0 || token.length > 128) return null;
  const id = hashToken(token);
  const [row] = await deps.db
    .select({
      expiresAt: authSessions.expiresAt,
      userId: users.id,
      role: users.role,
      status: users.status,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, id))
    .limit(1);
  if (!row) return null;

  const now = deps.now();
  if (row.expiresAt.getTime() <= now.getTime() || row.status !== "active") {
    await deps.db.delete(authSessions).where(eq(authSessions.id, id));
    return null;
  }

  const renewed = renewedSessionExpiry(row.role, row.expiresAt, now);
  if (renewed) {
    await deps.db.update(authSessions).set({ expiresAt: renewed }).where(eq(authSessions.id, id));
    // Attività per le regole di conservazione (R-PRIV-03): basta la granularità del rinnovo.
    await deps.db.update(users).set({ lastActiveAt: now }).where(eq(users.id, row.userId));
  }
  return { user: { id: row.userId, role: row.role }, expiresAt: renewed ?? row.expiresAt };
}

export async function deleteSession(deps: Pick<IdentityDeps, "db">, token: string): Promise<void> {
  await deps.db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
}

/** "Esci da tutti i dispositivi"; si usa anche alla cancellazione dell'account (WP-023). */
export async function deleteUserSessions(
  deps: Pick<IdentityDeps, "db">,
  userId: string,
): Promise<void> {
  await deps.db.delete(authSessions).where(eq(authSessions.userId, userId));
}

/**
 * Pulizia (job giornaliero, WP-020): sessioni e biglietti scaduti (anche quelli del secondo fattore); codici più vecchi di 24 ore
 * (fino ad allora servono a contare i limiti per email).
 */
export async function deleteExpiredAuthRows(deps: Deps): Promise<number> {
  const now = deps.now();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
  const results = await Promise.all([
    deps.db
      .delete(authSessions)
      .where(lt(authSessions.expiresAt, now))
      .returning({ id: authSessions.id }),
    deps.db
      .delete(authSignupTickets)
      .where(lt(authSignupTickets.expiresAt, now))
      .returning({ id: authSignupTickets.id }),
    deps.db
      .delete(authMfaTickets)
      .where(lt(authMfaTickets.expiresAt, now))
      .returning({ id: authMfaTickets.id }),
    deps.db
      .delete(authOtpChallenges)
      .where(and(lt(authOtpChallenges.createdAt, dayAgo), lt(authOtpChallenges.expiresAt, now)))
      .returning({ id: authOtpChallenges.id }),
  ]);
  return results.reduce((sum, rows) => sum + rows.length, 0);
}
