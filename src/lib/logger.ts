import pino, { type DestinationStream, type Logger } from "pino";

/**
 * Logger JSON con redazione dei dati personali (R-PRIV-05).
 * Regola: nei log vanno ID, azioni ed esiti — MAI email, telefoni, nomi, testi liberi, token.
 * La redazione è una rete di sicurezza, non un permesso a loggare oggetti con dati personali.
 */
const SENSITIVE_KEYS = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "name",
  "fullName",
  "address",
  "password",
  "token",
  "otp",
  "authorization",
  "cookie",
  "set-cookie",
  // Gli errori di Postgres mettono i valori (es. l'email duplicata) in `detail`.
  "detail",
  "bio",
  "cv",
  "body",
  "text",
];

// pino accetta percorsi con `*` per un livello: copriamo radice, 1 e 2 livelli di annidamento.
export const REDACT_PATHS = SENSITIVE_KEYS.flatMap((k) => {
  const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : `["${k}"]`;
  const join = (prefix: string) => (key.startsWith("[") ? `${prefix}${key}` : `${prefix}.${key}`);
  return [key, join("*"), join("*.*")];
});

export function createLogger(
  destination?: DestinationStream,
  level = process.env.LOG_LEVEL ?? "info",
): Logger {
  return pino(
    {
      level,
      base: { app: "hr" },
      redact: { paths: REDACT_PATHS, censor: "[REDATTO]" },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}

export const logger = createLogger();
