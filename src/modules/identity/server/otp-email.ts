import { fillTemplate, messages } from "@/i18n/messages";
import { OTP_TTL_MS } from "../domain";

/** Email con il codice: solo testo (si legge su qualsiasi telefono, niente immagini né link da cliccare). */
export function renderOtpEmail(code: string, appUrl: string): { subject: string; text: string } {
  const t = messages.emails.otp;
  const values = {
    code,
    minutes: String(OTP_TTL_MS / 60_000),
    siteName: messages.meta.siteName,
    appUrl,
  };
  return {
    subject: fillTemplate(t.subject, values),
    text: [t.intro, t.code, t.validity, t.ignore, t.signature]
      .map((line) => fillTemplate(line, values))
      .join("\n\n"),
  };
}
