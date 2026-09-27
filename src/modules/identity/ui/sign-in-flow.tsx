"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef } from "react";
import type { SelfSignupRole } from "../domain";
import { signInAction, type SignInState } from "../server/actions";

const input =
  "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground placeholder:text-muted";
const primaryButton =
  "w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60";
const linkButton = "text-base font-medium text-primary underline underline-offset-4";

/**
 * "Accedi o registrati" in tre passi (ADR-0013): email → codice → (solo la prima volta) account.
 * Aziende, moderatori e admin hanno un passo in più: il codice dell'app di autenticazione (WP-011b).
 * L'email resta nello stato del componente e nel corpo delle richieste, mai nell'URL.
 */
export function SignInFlow({ initialRole }: { initialRole?: SelfSignupRole }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {
    step: "email",
  });
  const errorId = useId();

  // Al cambio di passo il focus va sul titolo: chi usa un lettore di schermo sente dove si trova.
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [state.step]);

  const error =
    "error" in state && state.error
      ? t(`errors.${state.error}`, {
          attemptsLeft: "attemptsLeft" in state ? (state.attemptsLeft ?? 0) : 0,
        })
      : null;
  const errorBox = error ? (
    <p id={errorId} role="alert" className="rounded-lg border border-accent px-3 py-2 text-base">
      {error}
    </p>
  ) : null;
  const describedBy = error ? errorId : undefined;

  if (state.step === "unavailable") {
    return (
      <section className="flex flex-col gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {t("unavailableTitle")}
        </h2>
        <p>{t("unavailable")}</p>
      </section>
    );
  }

  if (state.step === "code") {
    return (
      <form action={action} className="flex flex-col gap-4" key="code">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {t("codeTitle")}
        </h2>
        <p>{t("codeSentTo", { email: state.email })}</p>
        {state.resent && !state.error && <p role="status">{t("codeResent")}</p>}
        <input type="hidden" name="email" value={state.email} />
        <label className="flex flex-col gap-2 text-base font-medium">
          {t("codeLabel")}
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 \-]{6,7}"
            maxLength={7}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${input} tracking-[0.3em]`}
          />
        </label>
        {errorBox}
        <button
          type="submit"
          name="intent"
          value="verify"
          disabled={pending}
          className={primaryButton}
        >
          {pending ? t("pending") : t("verify")}
        </button>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <button
            type="submit"
            name="intent"
            value="resend"
            formNoValidate
            disabled={pending}
            className={linkButton}
          >
            {t("resend")}
          </button>
          <button
            type="submit"
            name="intent"
            value="restart"
            formNoValidate
            disabled={pending}
            className={linkButton}
          >
            {t("changeEmail")}
          </button>
        </div>
      </form>
    );
  }

  if (state.step === "mfa") {
    const enrollment = state.enrollment;
    return (
      <section className="flex flex-col gap-5" key={enrollment ? "mfa-enroll" : "mfa"}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {enrollment ? t("mfa.enrollTitle") : t("mfa.title")}
        </h2>
        {enrollment ? (
          <>
            <p>{t("mfa.enrollIntro")}</p>
            <svg
              role="img"
              aria-label={t("mfa.qrLabel")}
              viewBox={`0 0 ${enrollment.qr.size} ${enrollment.qr.size}`}
              shapeRendering="crispEdges"
              className="size-56 self-center rounded-lg bg-white"
            >
              <path d={enrollment.qr.path} fill="#000" />
            </svg>
            <p className="flex flex-col gap-1">
              <span>{t("mfa.manualLabel")}</span>
              <code
                data-testid="mfa-secret"
                className="select-all break-all rounded-lg border border-border bg-surface px-3 py-2 font-mono text-lg"
              >
                {enrollment.secret}
              </code>
              <a href={enrollment.uri} className={linkButton}>
                {t("mfa.openApp")}
              </a>
            </p>
          </>
        ) : (
          <p>{t("mfa.intro")}</p>
        )}
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={state.email} />
          <label className="flex flex-col gap-2 text-base font-medium">
            {t("mfa.codeLabel")}
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 \-]{6,7}"
              maxLength={7}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={`${input} tracking-[0.3em]`}
            />
          </label>
          {errorBox}
          <button
            type="submit"
            name="intent"
            value="mfa"
            disabled={pending}
            className={primaryButton}
          >
            {pending ? t("pending") : enrollment ? t("mfa.activate") : t("verify")}
          </button>
          <button
            type="submit"
            name="intent"
            value="restart"
            formNoValidate
            disabled={pending}
            className={`${linkButton} self-start`}
          >
            {t("mfa.restart")}
          </button>
        </form>
        {!enrollment && (
          <details className="flex flex-col gap-3">
            <summary className={`${linkButton} cursor-pointer`}>{t("mfa.useRecovery")}</summary>
            <form action={action} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="email" value={state.email} />
              <label className="flex flex-col gap-2 text-base font-medium">
                {t("mfa.recoveryLabel")}
                <input
                  name="recovery"
                  required
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={16}
                  className={`${input} font-mono`}
                />
              </label>
              <button
                type="submit"
                name="intent"
                value="mfa_recovery"
                disabled={pending}
                className={primaryButton}
              >
                {pending ? t("pending") : t("mfa.recoverySubmit")}
              </button>
            </form>
          </details>
        )}
      </section>
    );
  }

  if (state.step === "recovery_codes") {
    return (
      <section className="flex flex-col gap-4">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {t("mfa.codesTitle")}
        </h2>
        <p>{t("mfa.codesIntro")}</p>
        <ul
          data-testid="recovery-codes"
          className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-3 font-mono text-lg"
        >
          {state.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <p className="font-medium">{t("mfa.codesWarning")}</p>
        <form action={action}>
          <button
            type="submit"
            name="intent"
            value="codes_saved"
            disabled={pending}
            className={primaryButton}
          >
            {pending ? t("pending") : t("mfa.codesDone")}
          </button>
        </form>
      </section>
    );
  }

  if (state.step === "signup") {
    const role = state.role ?? initialRole;
    return (
      <form action={action} className="flex flex-col gap-5" key="signup">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {t("signupTitle")}
        </h2>
        <p>{t("signupIntro", { email: state.email })}</p>
        <input type="hidden" name="email" value={state.email} />
        <fieldset className="flex flex-col gap-3" aria-describedby={describedBy}>
          <legend className="mb-2 text-base font-medium">{t("roleLegend")}</legend>
          {(["worker", "company_member"] as const).map((value) => (
            <label
              key={value}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3"
            >
              <input
                type="radio"
                name="role"
                value={value}
                required
                defaultChecked={role === value}
                className="size-5 shrink-0"
              />
              {t(`roles.${value}`)}
            </label>
          ))}
        </fieldset>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="adult" required className="mt-1 size-5 shrink-0" />
          {t("adultLabel")}
        </label>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="legal" required className="mt-1 size-5 shrink-0" />
            {t("legalLabel")}
          </label>
          <p className="flex flex-wrap gap-x-4 pl-8 text-base">
            <Link href="/privacy" target="_blank" className={linkButton}>
              {t("privacyLink")}
            </Link>
            <Link href="/condizioni" target="_blank" className={linkButton}>
              {t("termsLink")}
            </Link>
          </p>
        </div>
        {errorBox}
        <button
          type="submit"
          name="intent"
          value="signup"
          disabled={pending}
          className={primaryButton}
        >
          {pending ? t("pending") : t("createAccount")}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" key="email">
      <h2 ref={heading} tabIndex={-1} className="sr-only">
        {t("emailLabel")}
      </h2>
      <p>{t("intro")}</p>
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("emailLabel")}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          defaultValue={state.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={input}
        />
      </label>
      {errorBox}
      <button
        type="submit"
        name="intent"
        value="request"
        disabled={pending}
        className={primaryButton}
      >
        {pending ? t("pending") : t("sendCode")}
      </button>
    </form>
  );
}
