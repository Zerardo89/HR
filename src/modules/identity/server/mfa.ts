import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { decryptCredential, dekContextFor, encryptJson } from "@/lib/crypto";
import { auditLog, authMfaTickets, authRecoveryCodes, authTotp, users } from "@/lib/db/schema";
import {
  base32Decode,
  base32Encode,
  MFA_MAX_ATTEMPTS,
  MFA_TICKET_TTL_MS,
  requiresMfa,
  type UserRole,
} from "../domain";
import type { IdentityDeps } from "./deps";
import { finishSignIn, type SignedIn } from "./sessions";
import { hashToken, newToken } from "./tokens";
import { matchTotp, newRecoveryCodes, newTotpSecret } from "./totp";

/*
 * Secondo fattore (WP-011b): dopo il codice via email, aziende, moderatori e admin danno un codice TOTP
 * (o un codice di recupero). La sessione nasce solo dopo. Chi non ha ancora la 2FA la attiva in quel momento:
 * legge il QR, conferma con un codice, riceve i codici di recupero (mostrati una volta sola).
 *
 * Nel DB: il segreto TOTP cifrato con la DEK dell'utente, i codici di recupero solo come HMAC, il biglietto
 * del passo in più solo come SHA-256. Niente in chiaro.
 */

const secretLocation = (userId: string) => ({
  table: "auth_totp",
  column: "secret_enc",
  rowId: userId,
});

/** `enrollment` c'è quando l'utente deve ancora attivare la 2FA: il segreto (base32) da mostrare nel QR. */
export type MfaRequired = {
  status: "mfa_required";
  ticket: string;
  ticketExpiresAt: Date;
  enrollment: { secret: string } | null;
};

/** Chiamata dopo il primo fattore (codice email giusto) per un utente attivo. */
export async function startMfa(
  deps: IdentityDeps,
  user: { id: string; role: UserRole },
): Promise<MfaRequired> {
  if (!requiresMfa(user.role)) throw new Error("secondo fattore non previsto per questo ruolo");
  const now = deps.now();

  const [totp] = await deps.db
    .select({ confirmedAt: authTotp.confirmedAt })
    .from(authTotp)
    .where(eq(authTotp.userId, user.id))
    .limit(1);

  let enrollment: MfaRequired["enrollment"] = null;
  if (!totp?.confirmedAt) {
    // Attivazione: un segreto nuovo a ogni accesso finché non viene confermato (quello vecchio non vale più).
    const secret = newTotpSecret();
    try {
      const secretEnc = await encryptSecret(deps, user.id, secret);
      await deps.db
        .insert(authTotp)
        .values({ userId: user.id, secretEnc, createdAt: now })
        .onConflictDoUpdate({
          target: authTotp.userId,
          set: { secretEnc, lastUsedStep: null, createdAt: now },
          setWhere: isNull(authTotp.confirmedAt),
        });
      enrollment = { secret: base32Encode(secret) };
    } finally {
      secret.fill(0);
    }
  }

  // Un solo biglietto aperto per utente: i tentativi non si sommano tra accessi paralleli.
  const ticket = newToken();
  const ticketExpiresAt = new Date(now.getTime() + MFA_TICKET_TTL_MS);
  await deps.db.transaction(async (tx) => {
    await tx.delete(authMfaTickets).where(eq(authMfaTickets.userId, user.id));
    await tx.insert(authMfaTickets).values({
      id: hashToken(ticket),
      userId: user.id,
      expiresAt: ticketExpiresAt,
      createdAt: now,
    });
  });
  return { status: "mfa_required", ticket, ticketExpiresAt, enrollment };
}

export type MfaResult =
  | (SignedIn & { recoveryCodes: string[] | null })
  | { status: "wrong_code"; attemptsLeft: number; enrollment: { secret: string } | null }
  | { status: "expired" } // biglietto scaduto, tentativi finiti o già usato: si ricomincia dall'email
  | { status: "account_unavailable" };

/**
 * Codice dell'app di autenticazione. Alla prima conferma la 2FA diventa attiva e si generano i codici di
 * recupero (`recoveryCodes`, da mostrare una volta sola); agli accessi successivi `recoveryCodes` è null.
 */
export async function verifyMfaCode(
  deps: IdentityDeps,
  ticket: string,
  code: string,
  ip: string | null,
): Promise<MfaResult> {
  const claimed = await claimAttempt(deps, ticket);
  if (claimed.status !== "open") return claimed;
  const { user, attemptsLeft } = claimed;
  const now = deps.now();

  const [totp] = await deps.db.select().from(authTotp).where(eq(authTotp.userId, user.id)).limit(1);
  if (!totp) return { status: "expired" };
  const enrolling = totp.confirmedAt === null;

  const secret = await decryptSecret(deps, user, totp.secretEnc);
  let step: number | null;
  try {
    step = matchTotp(secret, code, now);
  } finally {
    secret.fill(0);
  }
  const replayed = step !== null && totp.lastUsedStep !== null && step <= totp.lastUsedStep;
  if (step === null || replayed) {
    return {
      status: "wrong_code",
      attemptsLeft,
      enrollment: enrolling ? { secret: await secretForDisplay(deps, user, totp.secretEnc) } : null,
    };
  }

  // Il passo si registra in modo atomico: due richieste con lo stesso codice non passano entrambe.
  const [accepted] = await deps.db
    .update(authTotp)
    .set({ lastUsedStep: step, confirmedAt: totp.confirmedAt ?? now })
    .where(
      and(
        eq(authTotp.userId, user.id),
        eq(authTotp.secretEnc, totp.secretEnc),
        or(isNull(authTotp.lastUsedStep), lt(authTotp.lastUsedStep, step)),
      ),
    )
    .returning({ userId: authTotp.userId });
  if (!accepted || !(await consumeTicket(deps, ticket))) return { status: "expired" };

  let recoveryCodes: string[] | null = null;
  if (enrolling) {
    recoveryCodes = newRecoveryCodes();
    const macs = await Promise.all(recoveryCodes.map((c) => recoveryMac(deps, user.id, c)));
    await deps.db.transaction(async (tx) => {
      await tx.delete(authRecoveryCodes).where(eq(authRecoveryCodes.userId, user.id));
      await tx
        .insert(authRecoveryCodes)
        .values(macs.map((codeMac) => ({ userId: user.id, codeMac, createdAt: now })));
      await tx.insert(auditLog).values(mfaAudit(user.id, "auth.mfa_enrolled", now));
    });
  }
  const signedIn = await finishSignIn(deps, user, ip);
  return { ...signedIn, recoveryCodes };
}

/** Codice di recupero (monouso), solo per chi ha già attivato la 2FA. Conta come un tentativo. */
export async function redeemRecoveryCode(
  deps: IdentityDeps,
  ticket: string,
  code: string,
  ip: string | null,
): Promise<MfaResult> {
  const claimed = await claimAttempt(deps, ticket);
  if (claimed.status !== "open") return claimed;
  const { user, attemptsLeft } = claimed;
  const now = deps.now();

  const [totp] = await deps.db
    .select({ confirmedAt: authTotp.confirmedAt })
    .from(authTotp)
    .where(eq(authTotp.userId, user.id))
    .limit(1);
  if (!totp?.confirmedAt) return { status: "wrong_code", attemptsLeft, enrollment: null };

  const [used] = await deps.db
    .update(authRecoveryCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(authRecoveryCodes.userId, user.id),
        eq(authRecoveryCodes.codeMac, await recoveryMac(deps, user.id, code)),
        isNull(authRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: authRecoveryCodes.id });
  if (!used) return { status: "wrong_code", attemptsLeft, enrollment: null };
  if (!(await consumeTicket(deps, ticket))) return { status: "expired" };

  await deps.db.insert(auditLog).values(mfaAudit(user.id, "auth.recovery_code_used", now));
  const signedIn = await finishSignIn(deps, user, ip);
  return { ...signedIn, recoveryCodes: null };
}

/**
 * Il segreto da rimostrare durante l'attivazione (per esempio dopo un codice scritto male), senza consumare
 * tentativi; `null` se il biglietto non vale più o la 2FA è già attiva.
 */
export async function pendingEnrollment(
  deps: IdentityDeps,
  ticket: string,
): Promise<{ secret: string } | null> {
  if (ticket.length === 0 || ticket.length > 128) return null;
  const [row] = await deps.db
    .select({
      userId: users.id,
      role: users.role,
      dekWrapped: users.dekWrapped,
      secretEnc: authTotp.secretEnc,
    })
    .from(authMfaTickets)
    .innerJoin(users, eq(users.id, authMfaTickets.userId))
    .innerJoin(authTotp, eq(authTotp.userId, authMfaTickets.userId))
    .where(
      and(
        eq(authMfaTickets.id, hashToken(ticket)),
        gt(authMfaTickets.expiresAt, deps.now()),
        isNull(authTotp.confirmedAt),
      ),
    )
    .limit(1);
  if (!row?.dekWrapped) return null;
  const user = { id: row.userId, role: row.role, dekWrapped: row.dekWrapped };
  return { secret: await secretForDisplay(deps, user, row.secretEnc) };
}

// ─── Interni ───────────────────────────────────────────────────────────────────────────────────────

type TicketUser = { id: string; role: UserRole; dekWrapped: string };

type Claimed =
  | { status: "open"; user: TicketUser; attemptsLeft: number }
  | { status: "expired" }
  | { status: "account_unavailable" };

/** Il tentativo si conta PRIMA del confronto e in modo atomico (come per il codice email). */
async function claimAttempt(deps: IdentityDeps, ticket: string): Promise<Claimed> {
  if (ticket.length === 0 || ticket.length > 128) return { status: "expired" };
  const now = deps.now();
  const [counted] = await deps.db
    .update(authMfaTickets)
    .set({ attempts: sql`${authMfaTickets.attempts} + 1` })
    .where(
      and(
        eq(authMfaTickets.id, hashToken(ticket)),
        lt(authMfaTickets.attempts, MFA_MAX_ATTEMPTS),
        gt(authMfaTickets.expiresAt, now),
      ),
    )
    .returning({ userId: authMfaTickets.userId, attempts: authMfaTickets.attempts });
  if (!counted) return { status: "expired" };

  const [user] = await deps.db
    .select({ id: users.id, role: users.role, status: users.status, dekWrapped: users.dekWrapped })
    .from(users)
    .where(eq(users.id, counted.userId))
    .limit(1);
  if (!user || user.status !== "active" || !user.dekWrapped) {
    return { status: "account_unavailable" };
  }
  return {
    status: "open",
    user: { id: user.id, role: user.role, dekWrapped: user.dekWrapped },
    attemptsLeft: MFA_MAX_ATTEMPTS - counted.attempts,
  };
}

/** Il biglietto vale una volta sola, anche con due richieste nello stesso istante. */
async function consumeTicket(deps: IdentityDeps, ticket: string): Promise<boolean> {
  const [deleted] = await deps.db
    .delete(authMfaTickets)
    .where(eq(authMfaTickets.id, hashToken(ticket)))
    .returning({ id: authMfaTickets.id });
  return Boolean(deleted);
}

async function encryptSecret(deps: IdentityDeps, userId: string, secret: Buffer): Promise<string> {
  const [user] = await deps.db
    .select({ dekWrapped: users.dekWrapped })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.dekWrapped) throw new Error("utente senza chiave");
  const dek = await deps.keys.unwrapKey(user.dekWrapped, dekContextFor("users", userId));
  try {
    return encryptJson(dek, base32Encode(secret), secretLocation(userId));
  } finally {
    dek.fill(0);
  }
}

async function secretForDisplay(
  deps: IdentityDeps,
  user: TicketUser,
  secretEnc: string,
): Promise<string> {
  return decryptCredential({
    provider: deps.keys,
    dekWrapped: user.dekWrapped,
    dekContext: dekContextFor("users", user.id),
    token: secretEnc,
    location: secretLocation(user.id),
    schema: z.string(),
  });
}

async function decryptSecret(
  deps: IdentityDeps,
  user: TicketUser,
  secretEnc: string,
): Promise<Buffer> {
  const bytes = base32Decode(await secretForDisplay(deps, user, secretEnc));
  if (!bytes) throw new Error("segreto TOTP non valido");
  return Buffer.from(bytes);
}

function recoveryMac(deps: IdentityDeps, userId: string, code: string): Promise<string> {
  return deps.keys.mac(`${userId}:${code}`, "recovery");
}

function mfaAudit(userId: string, action: string, at: Date) {
  return { actorId: userId, action, targetTable: "users", targetId: userId, at };
}
