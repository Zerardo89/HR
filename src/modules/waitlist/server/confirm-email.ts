import { fillTemplate, messages } from "@/i18n/messages";
import { CONFIRM_TOKEN_TTL_MS } from "../domain";

export const CONFIRM_PATH = "/lista-attesa/conferma";

/** Email di conferma: il link apre una pagina con un pulsante, non conferma da solo (R-MAIL-02). */
export function renderConfirmEmail(
  token: string,
  appUrl: string,
): { subject: string; text: string } {
  const t = messages.emails.waitlistConfirm;
  const values = {
    link: `${appUrl}${CONFIRM_PATH}?t=${token}`,
    days: String(CONFIRM_TOKEN_TTL_MS / (24 * 60 * 60_000)),
    siteName: messages.meta.siteName,
    appUrl,
  };
  return {
    subject: fillTemplate(t.subject, values),
    text: [t.intro, t.link, t.validity, t.ignore, t.signature]
      .map((line) => fillTemplate(line, values))
      .join("\n\n"),
  };
}
