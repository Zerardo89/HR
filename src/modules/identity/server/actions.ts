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
  | { step: "signup"; email: string; role?: SelfSignupRole; error?: "signup_incomplete" }
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
  await setSessionCookie(result.session.token);
  redirect(AFTER_SIGN_IN);
}
