import "server-only";
import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Invio delle email (SMTP: Mailpit in sviluppo, Brevo in produzione). Il fornitore si cambia solo qui.
 * R-PRIV-05: nei log mai il destinatario né il contenuto, solo l'esito.
 */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Intestazioni aggiuntive, per esempio `List-Unsubscribe` e `List-Unsubscribe-Post` (RFC 8058, R-MAIL-01). */
  headers?: Record<string, string>;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class MailError extends Error {
  constructor() {
    super("Invio email non riuscito");
    this.name = "MailError";
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
};

export function createSmtpMailer(config: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    // Con le credenziali (Brevo) la connessione deve essere cifrata; Mailpit in locale non le usa.
    requireTLS: Boolean(config.user),
    auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
  });

  return {
    async send(message) {
      try {
        await transport.sendMail({ from: config.from, ...message });
      } catch (error) {
        const e = error as { code?: string; responseCode?: number };
        logger.error(
          { smtpCode: e.code, responseCode: e.responseCode },
          "invio email non riuscito",
        );
        throw new MailError();
      }
    },
  };
}

let mailer: Mailer | undefined;

export function getMailer(): Mailer {
  if (!mailer) {
    const env = getServerEnv();
    mailer = createSmtpMailer({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASS || undefined,
      from: env.MAIL_FROM,
    });
  }
  return mailer;
}
