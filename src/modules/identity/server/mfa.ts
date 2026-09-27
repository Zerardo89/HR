import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { messages } from "@/i18n/messages";
import { authRecoveryCodes, authSessions, users } from "@/lib/db/schema";
import {
  formatRecoveryCode,
  MFA_MAX_ATTEMPTS,
  normalizeOtpInput,
  normalizeRecoveryInput,
  RECOVERY_CODE_COUNT,
} from "../domain";
import type { IdentityDeps } from "./deps";
import { hashToken } from "./tokens";
import { base32Encode, matchTotp, newRecoveryCode, newTotpSecret, otpauthUri } from "./totp";

/*
 * Verifica in due passaggi (WP-011b, ADR-0013 §8). Il segreto TOTP è materiale di chiave: si salva cifrato con la
 * KEK (`wrapKey`), legato all'id dell'utente. I codici di recupero si salvano solo come MAC.
 */

type Deps = Pick<IdentityDeps, "db" | "keys" | "now">;

const secretContext = (userId: string) => `users.totp:${userId}`;
const recoveryMac = (deps: Deps, userId: string, code: string) =>
  deps.keys.mac(`${userId}:${code}`, "recovery");

export type EnrollmentStart =
  { status: "pending"; secretBase32: string; uri: string } | { status: "already_enabled" };

/** Prepara (o riprende) l'attivazione: il segreto resta "in attesa" finché l'utente non conferma un codice. */
export async function startTotpEnrollment(deps: Deps, userId: string): Promise<EnrollmentStart> {
  const [row] = await deps.db
    .select({ enc: users.totpSecretEnc, enabledAt: users.totpEnabledAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("utente inesistente");
  if (row.enabledAt) return { status: "already_enabled" };

  let secret: Buffer;
  if (row.enc) {
    secret = await deps.keys.unwrapKey(row.enc, secretContext(userId));
  } else {
    secret = newTotpSecret();
    const wrapped = await deps.keys.wrapKey(secret, secretContext(userId));
    const [saved] = await deps.db
      .update(users)
      .set({ totpSecretEnc: wrapped })
      .where(and(eq(users.id, userId), isNull(users.totpSecretEnc)))
      .returning({ id: users.id });
    if (!saved) return startTotpEnrollment(deps, userId); // un'altra scheda l'ha appena creato
  }
  try {
    const secretBase32 = base32Encode(secret);
    return {
      status: "pending",
      secretBase32,
      uri: otpauthUri(secretBase32, messages.meta.siteName, messages.mfa.accountLabel),
    };
  } finally {
    secret.fill(0);
  }
}

export type EnrollmentResult =
  | { status: "enabled"; recoveryCodes: string[] }
  | { status: "wrong_code" }
  | { status: "already_enabled" }
  | { status: "not_started" };

/** Conferma con un codice dell'app: attiva la 2FA, crea i codici di recupero, verifica la sessione corrente. */
export async function confirmTotpEnrollment(
  deps: Deps,
  userId: string,
  sessionToken: string,
  input: string,
): Promise<EnrollmentResult> {
  const now = deps.now();
  const [row] = await deps.db
    .select({
      enc: users.totpSecretEnc,
      enabledAt: users.totpEnabledAt,
      lastStep: users.totpLastStep,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("utente inesistente");
  if (row.enabledAt) return { status: "already_enabled" };
  if (!row.enc) return { status: "not_started" };

  const code = normalizeOtpInput(input);
  const secret = await deps.keys.unwrapKey(row.enc, secretContext(userId));
  const step = code ? matchTotp(secret, code, now, row.lastStep) : null;
  secret.fill(0);
  if (step === null) return { status: "wrong_code" };

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => newRecoveryCode());
  const macs = await Promise.all(codes.map((c) => recoveryMac(deps, userId, c)));
  const enabled = await deps.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ totpEnabledAt: now, totpLastStep: step })
      .where(and(eq(users.id, userId), isNull(users.totpEnabledAt)))
      .returning({ id: users.id });
    if (!updated) return false;
    await tx.delete(authRecoveryCodes).where(eq(authRecoveryCodes.userId, userId));
    await tx
      .insert(authRecoveryCodes)
      .values(macs.map((codeMac) => ({ userId, codeMac, createdAt: now })));
    await tx
      .update(authSessions)
      .set({ mfaVerifiedAt: now })
      .where(and(eq(authSessions.id, hashToken(sessionToken)), eq(authSessions.userId, userId)));
    return true;
  });
  return enabled
    ? { status: "enabled", recoveryCodes: codes.map(formatRecoveryCode) }
    : { status: "already_enabled" };
}

export type SecondFactorResult =
  | { status: "verified"; usedRecoveryCode: boolean }
  | { status: "wrong_code"; attemptsLeft: number }
  | { status: "locked" } // troppi tentativi: sessione chiusa, si riparte dall'email
  | { status: "no_session" }
  | { status: "not_enabled" };

/** Secondo passaggio dopo il codice email: codice dell'app oppure un codice di recupero (monouso). */
export async function verifySecondFactor(
  deps: Deps,
  sessionToken: string,
  input: string,
): Promise<SecondFactorResult> {
  const now = deps.now();
  const sessionId = hashToken(sessionToken);
  const [row] = await deps.db
    .select({
      userId: users.id,
      status: users.status,
      enc: users.totpSecretEnc,
      enabledAt: users.totpEnabledAt,
      lastStep: users.totpLastStep,
      expiresAt: authSessions.expiresAt,
      verifiedAt: authSessions.mfaVerifiedAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, sessionId))
    .limit(1);
  if (!row || row.status !== "active" || row.expiresAt.getTime() <= now.getTime()) {
    return { status: "no_session" };
  }
  if (!row.enabledAt || !row.enc) return { status: "not_enabled" };
  if (row.verifiedAt) return { status: "verified", usedRecoveryCode: false };

  // Il tentativo si conta prima del controllo, in modo atomico.
  const [counted] = await deps.db
    .update(authSessions)
    .set({ mfaAttempts: sql`${authSessions.mfaAttempts} + 1` })
    .where(and(eq(authSessions.id, sessionId), lt(authSessions.mfaAttempts, MFA_MAX_ATTEMPTS)))
    .returning({ attempts: authSessions.mfaAttempts });
  if (!counted) {
    await deps.db.delete(authSessions).where(eq(authSessions.id, sessionId));
    return { status: "locked" };
  }

  let ok = false;
  let usedRecoveryCode = false;
  const code = normalizeOtpInput(input);
  const recovery = code ? null : normalizeRecoveryInput(input);
  if (code) {
    const secret = await deps.keys.unwrapKey(row.enc, secretContext(row.userId));
    const step = matchTotp(secret, code, now, row.lastStep);
    secret.fill(0);
    if (step !== null) {
      // Lo stesso codice non vale due volte, nemmeno con due richieste nello stesso istante.
      const [saved] = await deps.db
        .update(users)
        .set({ totpLastStep: step })
        .where(
          and(
            eq(users.id, row.userId),
            or(isNull(users.totpLastStep), lt(users.totpLastStep, step)),
          ),
        )
        .returning({ id: users.id });
      ok = Boolean(saved);
    }
  } else if (recovery) {
    const mac = await recoveryMac(deps, row.userId, recovery);
    const [used] = await deps.db
      .update(authRecoveryCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(authRecoveryCodes.userId, row.userId),
          eq(authRecoveryCodes.codeMac, mac),
          isNull(authRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: authRecoveryCodes.id });
    ok = Boolean(used);
    usedRecoveryCode = ok;
  }

  if (ok) {
    await deps.db
      .update(authSessions)
      .set({ mfaVerifiedAt: now })
      .where(eq(authSessions.id, sessionId));
    return { status: "verified", usedRecoveryCode };
  }
  const attemptsLeft = MFA_MAX_ATTEMPTS - counted.attempts;
  if (attemptsLeft <= 0) {
    await deps.db.delete(authSessions).where(eq(authSessions.id, sessionId));
    return { status: "locked" };
  }
  return { status: "wrong_code", attemptsLeft };
}
