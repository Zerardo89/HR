"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  emailInput,
  formatSecretForDisplay,
  normalizeOtpInput,
  normalizeRecoveryInput,
  otpauthUri,
  signupInput,
  type SelfSignupRole,
} from "../domain";
import {
  clearMfaTicket,
  clearPendingSession,
  clearSessionCookie,
  clearSignupTicket,
  readMfaTicket,
  readPendingSession,
  readSessionToken,
  readSignupTicket,
  setMfaTicket,
  setPendingSession,
  setSessionCookie,
  setSignupTicket,
} from "./cookies";
import {
  pendingEnrollment,
  redeemRecoveryCode,
  verifyMfaCode,
  type MfaRequired,
  type MfaResult,
} from "./mfa";
import { qrSvgPath } from "./qr";
import { clientIp, ipLimiters, runtimeDeps } from "./runtime";
import { deleteSession, type SignedIn } from "./sessions";
import { completeSignup, requestLoginCode, verifyLoginCode } from "./sign-in";

/*
 * Server Actions dell'accesso (ADR-0013). Next.js confronta `Origin` e `Host` (protezione CSRF).
 * L'email viaggia solo nel corpo delle richieste POST, mai nell'URL (R-PRIV-05).
 */

export type SignInState =
  | {
      step: "email";
      email?: string;
      error?: "invalid_email" | "rate_limited" | "send_failed" | "signup_expired" | "mfa_expired";
    }
  | {
      step: "code";
      email: string;
      resent?: boolean;
      error?:
        "invalid_code" | "wrong_code" | "no_attempts" | "expired" | "rate_limited" | "send_failed";
      attemptsLeft?: number;
    }
  | { step: "signup"; email: string; role?: SelfSignupRole; error?: "signup_incomplete" }
  | {
      step: "mfa";
      email: string;
      /** Solo alla prima volta: il segreto da aggiungere all'app (QR + testo per chi lo copia a mano). */
      enrollment?: MfaEnrollment;
      error?: "invalid_code" | "invalid_recovery" | "wrong_code" | "no_attempts" | "rate_limited";
      attemptsLeft?: number;
    }
  | { step: "recovery_codes"; codes: string[] }
  | { step: "unavailable" };

export type MfaEnrollment = { secret: string; uri: string; qr: { size: number; path: string } };

const AFTER_SIGN_IN = "/account";

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  switch (form.get("intent")) {
    case "request":
      return requestCode(form, false);
    case "resend":
      return requestCode(form, true);
    case "verify":
      return verifyCode(form);
    case "signup":
      return signUp(form);
    case "mfa":
      return verifyMfa(form, "totp");
    case "mfa_recovery":
      return verifyMfa(form, "recovery");
    case "codes_saved":
      return afterRecoveryCodes();
    default: {
      // "Cambia email": si torna al primo passo con l'email già scritta.
      const email = emailInput.safeParse(form.get("email"));
      return { step: "email", email: email.success ? email.data : undefined };
    }
  }
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await deleteSession(runtimeDeps(), token);
  await clearSessionCookie();
  redirect("/");
}

async function requestCode(form: FormData, resend: boolean): Promise<SignInState> {
  const parsed = emailInput.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", error: "invalid_email" };
  const email = parsed.data;

  const ip = clientIp(await headers());
  const result =
    ip && !ipLimiters().codeRequests.hit(ip, Date.now())
      ? ({ status: "rate_limited" } as const)
      : await requestLoginCode(runtimeDeps(), email);

  if (result.status === "sent") return { step: "code", email, resent: resend };
  return resend
    ? { step: "code", email, error: result.status }
    : { step: "email", email, error: result.status };
}

async function verifyCode(form: FormData): Promise<SignInState> {
  const parsed = emailInput.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", error: "invalid_email" };
  const email = parsed.data;

  const code = normalizeOtpInput(String(form.get("code") ?? ""));
  if (!code) return { step: "code", email, error: "invalid_code" };

  const ip = clientIp(await headers());
  if (ip && !ipLimiters().codeChecks.hit(ip, Date.now())) {
    return { step: "code", email, error: "rate_limited" };
  }

  const result = await verifyLoginCode(runtimeDeps(), email, code, ip);
  switch (result.status) {
    case "signed_in":
      return enterAccount(result);
    case "mfa_required":
      return askSecondFactor(result, email);
    case "signup_required":
      await setSignupTicket(result.ticket, result.ticketExpiresAt);
      return { step: "signup", email };
    case "wrong_code":
      return {
        step: "code",
        email,
        error: result.attemptsLeft > 0 ? "wrong_code" : "no_attempts",
        attemptsLeft: result.attemptsLeft,
      };
    case "expired":
      return { step: "code", email, error: "expired" };
    case "account_unavailable":
      return { step: "unavailable" };
  }
}

async function signUp(form: FormData): Promise<SignInState> {
  const parsed = signupInput.safeParse({
    email: form.get("email"),
    role: form.get("role"),
    adult: form.get("adult"),
    legal: form.get("legal"),
  });
  if (!parsed.success) {
    const email = emailInput.safeParse(form.get("email"));
    if (!email.success) return { step: "email", error: "invalid_email" };
    const role = form.get("role");
    return {
      step: "signup",
      email: email.data,
      role: role === "worker" || role === "company_member" ? role : undefined,
      error: "signup_incomplete",
    };
  }

  const ticket = await readSignupTicket();
  const result = ticket
    ? await completeSignup(runtimeDeps(), parsed.data, ticket)
    : ({ status: "expired" } as const);
  if (result.status === "expired") {
    await clearSignupTicket();
    return { step: "email", email: parsed.data.email, error: "signup_expired" };
  }
  if (result.status === "account_unavailable") return { step: "unavailable" };

  await clearSignupTicket();
  if (result.status === "mfa_required") return askSecondFactor(result, parsed.data.email);
  return enterAccount(result);
}

async function verifyMfa(form: FormData, kind: "totp" | "recovery"): Promise<SignInState> {
  const parsed = emailInput.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", error: "invalid_email" };
  const email = parsed.data;
  const ticket = await readMfaTicket();
  // Codice scritto male o troppi tentativi dallo stesso IP: nessun tentativo consumato, stesso passo.
  const again = async (
    error: "invalid_code" | "invalid_recovery" | "rate_limited",
  ): Promise<SignInState> => {
    const pending = ticket ? await pendingEnrollment(runtimeDeps(), ticket) : null;
    return {
      step: "mfa",
      email,
      enrollment: pending ? await enrollmentView(pending.secret, email) : undefined,
      error,
    };
  };

  const input = String(form.get(kind === "totp" ? "code" : "recovery") ?? "");
  const code = kind === "totp" ? normalizeOtpInput(input) : normalizeRecoveryInput(input);
  if (!code) return again(kind === "totp" ? "invalid_code" : "invalid_recovery");

  const ip = clientIp(await headers());
  if (ip && !ipLimiters().codeChecks.hit(ip, Date.now())) return again("rate_limited");

  const result: MfaResult = ticket
    ? kind === "totp"
      ? await verifyMfaCode(runtimeDeps(), ticket, code, ip)
      : await redeemRecoveryCode(runtimeDeps(), ticket, code, ip)
    : { status: "expired" };

  switch (result.status) {
    case "signed_in":
      await clearMfaTicket();
      if (result.recoveryCodes) {
        // Prima attivazione: prima di entrare si mostrano i codici di recupero (una volta sola).
        await setPendingSession(result.session.token);
        return { step: "recovery_codes", codes: result.recoveryCodes };
      }
      return enterAccount(result);
    case "wrong_code":
      return {
        step: "mfa",
        email,
        enrollment: result.enrollment
          ? await enrollmentView(result.enrollment.secret, email)
          : undefined,
        error: result.attemptsLeft > 0 ? "wrong_code" : "no_attempts",
        attemptsLeft: result.attemptsLeft,
      };
    case "expired":
      await clearMfaTicket();
      return { step: "email", email, error: "mfa_expired" };
    case "account_unavailable":
      await clearMfaTicket();
      return { step: "unavailable" };
  }
}

async function afterRecoveryCodes(): Promise<SignInState> {
  const token = await readPendingSession();
  if (!token) return { step: "email", error: "mfa_expired" };
  await clearPendingSession();
  await setSessionCookie(token);
  redirect(AFTER_SIGN_IN);
}

async function enterAccount(result: SignedIn): Promise<never> {
  await clearSignupTicket();
  await setSessionCookie(result.session.token);
  redirect(AFTER_SIGN_IN);
}

async function askSecondFactor(result: MfaRequired, email: string): Promise<SignInState> {
  await setMfaTicket(result.ticket, result.ticketExpiresAt);
  return {
    step: "mfa",
    email,
    enrollment: result.enrollment
      ? await enrollmentView(result.enrollment.secret, email)
      : undefined,
  };
}

async function enrollmentView(secret: string, email: string): Promise<MfaEnrollment> {
  const t = await getTranslations("meta");
  const uri = otpauthUri(secret, t("siteName"), email);
  return { secret: formatSecretForDisplay(secret), uri, qr: qrSvgPath(uri) };
}
