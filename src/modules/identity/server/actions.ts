"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { emailInput, normalizeOtpInput, signupInput, type SelfSignupRole } from "../domain";
import {
  clearSessionCookie,
  clearSignupTicket,
  readSessionToken,
  readSignupTicket,
  setSessionCookie,
  setSignupTicket,
} from "./cookies";
import { requireUser } from "./current-user";
import { confirmTotpEnrollment, verifySecondFactor } from "./mfa";
import { clientIp, ipLimiters, runtimeDeps } from "./runtime";
import { deleteSession } from "./sessions";
import { completeSignup, requestLoginCode, verifyLoginCode } from "./sign-in";

/*
 * Server Actions dell'accesso (ADR-0013). Next.js confronta `Origin` e `Host` (protezione CSRF).
 * L'email viaggia solo nel corpo delle richieste POST, mai nell'URL (R-PRIV-05).
 */

export type SignInState =
  | {
      step: "email";
      email?: string;
      error?: "invalid_email" | "rate_limited" | "send_failed" | "signup_expired";
    }
  | {
      step: "code";
      email: string;
      resent?: boolean;
      error?:
        "invalid_code" | "wrong_code" | "no_attempts" | "expired" | "rate_limited" | "send_failed";
      attemptsLeft?: number;
    }
  | {
      step: "signup";
      email: string;
      role?: SelfSignupRole;
      /** Le due caselle erano spuntate: dopo un errore sul codice invito restano spuntate. */
      accepted?: boolean;
      error?: "signup_incomplete" | "invite_invalid" | "rate_limited";
    }
  | { step: "unavailable" };

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
      await clearSignupTicket();
      await setSessionCookie(result.session.token);
      redirect(AFTER_SIGN_IN);
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
    inviteCode: form.get("inviteCode") ?? undefined,
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

  const deps = runtimeDeps();
  const { email, role } = parsed.data;
  // Anteprima (WP-010b): i tentativi sul codice invito contano nel limite per IP dei codici.
  if (deps.previewInviteCodes) {
    const ip = clientIp(await headers());
    if (ip && !ipLimiters().codeChecks.hit(ip, Date.now())) {
      return { step: "signup", email, role, accepted: true, error: "rate_limited" };
    }
  }

  const ticket = await readSignupTicket();
  const result = ticket
    ? await completeSignup(deps, parsed.data, ticket)
    : ({ status: "expired" } as const);
  if (result.status === "expired") {
    await clearSignupTicket();
    return { step: "email", email, error: "signup_expired" };
  }
  if (result.status === "invite_required")
    return { step: "signup", email, role, accepted: true, error: "invite_invalid" };
  if (result.status === "account_unavailable") return { step: "unavailable" };

  await clearSignupTicket();
  await setSessionCookie(result.session.token);
  redirect(AFTER_SIGN_IN);
}

// ─── Verifica in due passaggi (WP-011b) ────────────────────────────────────────────────────────────

export type MfaVerifyState =
  { status: "idle" } | { status: "wrong_code"; attemptsLeft: number } | { status: "locked" };

export async function verifySecondFactorAction(
  _prev: MfaVerifyState,
  form: FormData,
): Promise<MfaVerifyState> {
  const token = await readSessionToken();
  if (!token) redirect("/accedi");
  const input = String(form.get("code") ?? "").slice(0, 32);
  const result = await verifySecondFactor(runtimeDeps(), token, input);
  switch (result.status) {
    case "verified":
    case "not_enabled":
      redirect(AFTER_SIGN_IN);
    case "no_session":
      redirect("/accedi");
    case "locked":
      await clearSessionCookie();
      return { status: "locked" };
    case "wrong_code":
      return { status: "wrong_code", attemptsLeft: result.attemptsLeft };
  }
}

export type MfaSetupState =
  | { status: "idle" }
  | { status: "enabled"; recoveryCodes: string[] }
  | { status: "error"; error: "wrong_code" | "not_started" | "already_enabled" };

export async function confirmTotpAction(
  _prev: MfaSetupState,
  form: FormData,
): Promise<MfaSetupState> {
  const user = await requireUser(undefined, "setup");
  const token = await readSessionToken();
  if (!token) redirect("/accedi");
  const input = String(form.get("code") ?? "").slice(0, 32);
  const result = await confirmTotpEnrollment(runtimeDeps(), user.id, token, input);
  return result.status === "enabled" ? result : { status: "error", error: result.status };
}
