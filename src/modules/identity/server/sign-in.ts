import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { dekContextFor, encryptJson, newDataKey, normalizeEmail } from "@/lib/crypto";
import { authOtpChallenges, authSignupTickets, consents, users } from "@/lib/db/schema";
import {
  emailCodeLimitReached,
  LEGAL_VERSIONS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  otpChallengeStatus,
  requiresMfa,
  SIGNUP_TICKET_TTL_MS,
  type SignupInput,
  type UserRole,
} from "../domain";
import type { IdentityDeps } from "./deps";
import { startMfa, type MfaRequired } from "./mfa";
import { renderOtpEmail } from "./otp-email";
import { finishSignIn, type SignedIn } from "./sessions";
import { hashToken, newOtpCode, newToken, safeEqual } from "./tokens";

/*
 * Accesso con codice via email (ADR-0013). Le email arrivano GIÀ validate e normalizzate (`emailInput`).
 * Nel DB finiscono solo l'indice cieco dell'email, l'HMAC del codice e l'hash dei token.
 */

export type RequestCodeResult = { status: "sent" | "rate_limited" | "send_failed" };

/** Stessa risposta per email registrate e non: il codice parte comunque (serve anche per registrarsi). */
export async function requestLoginCode(
  deps: IdentityDeps,
  email: string,
): Promise<RequestCodeResult> {
  const now = deps.now();
  const emailBidx = await deps.keys.blindIndex(email, "email");

  const recent = await deps.db
    .select({ createdAt: authOtpChallenges.createdAt })
    .from(authOtpChallenges)
    .where(
      and(
        eq(authOtpChallenges.emailBidx, emailBidx),
        gt(authOtpChallenges.createdAt, new Date(now.getTime() - 24 * 60 * 60_000)),
      ),
    );
  if (
    emailCodeLimitReached(
      recent.map((r) => r.createdAt),
      now,
    )
  )
    return { status: "rate_limited" };

  const id = randomUUID();
  const code = newOtpCode();
  const codeMac = await deps.keys.mac(`${id}:${code}`, "otp");
  await deps.db.transaction(async (tx) => {
    // Un solo codice attivo per email: i precedenti smettono di valere.
    await tx
      .update(authOtpChallenges)
      .set({ consumedAt: now })
      .where(and(eq(authOtpChallenges.emailBidx, emailBidx), isNull(authOtpChallenges.consumedAt)));
    await tx.insert(authOtpChallenges).values({
      id,
      emailBidx,
      codeMac,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      createdAt: now,
    });
  });

  try {
    await deps.mailer.send({ to: email, ...renderOtpEmail(code, deps.appUrl) });
  } catch {
    await deps.db
      .update(authOtpChallenges)
      .set({ consumedAt: now })
      .where(eq(authOtpChallenges.id, id));
    return { status: "send_failed" };
  }
  return { status: "sent" };
}

export type { SignedIn } from "./sessions";

export type VerifyCodeResult =
  | SignedIn
  | MfaRequired // aziende, moderatori e admin: prima della sessione serve il secondo fattore (mfa.ts)
  | { status: "signup_required"; ticket: string; ticketExpiresAt: Date }
  | { status: "wrong_code"; attemptsLeft: number }
  | { status: "expired" } // nessun codice valido (scaduto, tentativi finiti, già usato): chiederne un altro
  | { status: "account_unavailable" };

export async function verifyLoginCode(
  deps: IdentityDeps,
  email: string,
  code: string,
  ip: string | null,
): Promise<VerifyCodeResult> {
  const now = deps.now();
  const emailBidx = await deps.keys.blindIndex(email, "email");

  const [challenge] = await deps.db
    .select()
    .from(authOtpChallenges)
    .where(and(eq(authOtpChallenges.emailBidx, emailBidx), isNull(authOtpChallenges.consumedAt)))
    .orderBy(desc(authOtpChallenges.createdAt))
    .limit(1);
  if (!challenge || otpChallengeStatus(challenge, now) !== "open") return { status: "expired" };

  // Il tentativo si conta PRIMA del confronto e in modo atomico: richieste parallele non ne guadagnano altri.
  const [counted] = await deps.db
    .update(authOtpChallenges)
    .set({ attempts: sql`${authOtpChallenges.attempts} + 1` })
    .where(
      and(
        eq(authOtpChallenges.id, challenge.id),
        isNull(authOtpChallenges.consumedAt),
        lt(authOtpChallenges.attempts, OTP_MAX_ATTEMPTS),
        gt(authOtpChallenges.expiresAt, now),
      ),
    )
    .returning({ attempts: authOtpChallenges.attempts });
  if (!counted) return { status: "expired" };

  const expected = await deps.keys.mac(`${challenge.id}:${code}`, "otp");
  if (!safeEqual(expected, challenge.codeMac)) {
    return { status: "wrong_code", attemptsLeft: OTP_MAX_ATTEMPTS - counted.attempts };
  }

  // Il codice vale una volta sola, anche con due richieste nello stesso istante.
  const [consumed] = await deps.db
    .update(authOtpChallenges)
    .set({ consumedAt: now })
    .where(and(eq(authOtpChallenges.id, challenge.id), isNull(authOtpChallenges.consumedAt)))
    .returning({ id: authOtpChallenges.id });
  if (!consumed) return { status: "expired" };

  const [user] = await deps.db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.emailBidx, emailBidx))
    .limit(1);

  if (!user) {
    const ticket = newToken();
    const ticketExpiresAt = new Date(now.getTime() + SIGNUP_TICKET_TTL_MS);
    await deps.db
      .insert(authSignupTickets)
      .values({ id: hashToken(ticket), emailBidx, expiresAt: ticketExpiresAt, createdAt: now });
    return { status: "signup_required", ticket, ticketExpiresAt };
  }
  return signIn(deps, user, ip);
}

export type SignupResult =
  SignedIn | MfaRequired | { status: "expired" } | { status: "account_unavailable" };

/**
 * Crea l'account dopo il codice giusto. Il biglietto vale una volta sola e solo per l'email che ha
 * ricevuto il codice. L'email si salva cifrata con la DEK del nuovo utente (ADR-0004).
 */
export async function completeSignup(
  deps: IdentityDeps,
  input: SignupInput,
  ticket: string,
): Promise<SignupResult> {
  const now = deps.now();
  const emailBidx = await deps.keys.blindIndex(input.email, "email");

  const [used] = await deps.db
    .delete(authSignupTickets)
    .where(
      and(
        eq(authSignupTickets.id, hashToken(ticket)),
        eq(authSignupTickets.emailBidx, emailBidx),
        gt(authSignupTickets.expiresAt, now),
      ),
    )
    .returning({ id: authSignupTickets.id });
  if (!used) return { status: "expired" };

  const userId = randomUUID();
  const { dek, dekWrapped, keyVersion } = await newDataKey(
    deps.keys,
    dekContextFor("users", userId),
  );
  let emailEnc: string;
  try {
    emailEnc = encryptJson(dek, normalizeEmail(input.email), {
      table: "users",
      column: "email_enc",
      rowId: userId,
    });
  } finally {
    dek.fill(0);
  }

  const created = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        id: userId,
        role: input.role,
        emailBidx,
        emailEnc,
        dekWrapped,
        keyVersion,
        adultDeclaredAt: now,
        createdAt: now,
        lastActiveAt: now,
      })
      .onConflictDoNothing({ target: users.emailBidx })
      .returning({ id: users.id });
    if (!row) return false;
    await tx.insert(consents).values([
      { userId, type: "privacy_notice", version: LEGAL_VERSIONS.privacyNotice, grantedAt: now },
      { userId, type: "terms", version: LEGAL_VERSIONS.terms, grantedAt: now },
    ]);
    return true;
  });
  if (created) return signIn(deps, { id: userId, role: input.role, status: "active" }, null);

  // Registrazione già completata in un'altra scheda: l'email è verificata, si entra nell'account esistente.
  const [existing] = await deps.db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.emailBidx, emailBidx))
    .limit(1);
  if (!existing) return { status: "expired" };
  return signIn(deps, existing, null);
}

/** Primo fattore superato: sessione subito per chi cerca lavoro, secondo fattore per tutti gli altri. */
async function signIn(
  deps: IdentityDeps,
  user: { id: string; role: UserRole; status: string },
  ip: string | null,
): Promise<SignedIn | MfaRequired | { status: "account_unavailable" }> {
  if (user.status !== "active") return { status: "account_unavailable" };
  if (requiresMfa(user.role)) return startMfa(deps, user);
  return finishSignIn(deps, user, ip);
}
