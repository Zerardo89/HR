import "server-only";
import { getKeyProvider } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { flags } from "@/lib/flags";
import { getMailer } from "@/lib/mail";
import { MemoryLimiter, IP_LIMITS, parseInviteCodes } from "../domain";
import type { IdentityDeps } from "./deps";

/** Dipendenze reali (DB, chiavi, SMTP) per le Server Actions e le pagine. */
export function runtimeDeps(): IdentityDeps {
  const env = getServerEnv();
  return {
    db: getDb(),
    keys: getKeyProvider(),
    mailer: getMailer(),
    now: () => new Date(),
    appUrl: env.APP_URL,
    // In anteprima senza codici configurati il sito non parte (env.ts): qui l'elenco c'è sempre.
    previewInviteCodes: flags.previewMode
      ? parseInviteCodes(env.PREVIEW_INVITE_CODES ?? "")
      : undefined,
  };
}

/** Cookie `Secure` e prefisso `__Host-` quando l'app è servita in HTTPS (sempre, tranne lo sviluppo locale). */
export function secureCookies(): boolean {
  return getServerEnv().APP_URL.startsWith("https://");
}

export { clientIp } from "@/lib/client-ip";

type IpLimiters = { codeRequests: MemoryLimiter; codeChecks: MemoryLimiter };
const store = globalThis as typeof globalThis & { __hrIpLimiters?: IpLimiters };

/** Un'istanza per processo (anche se Next.js carica il modulo più volte). */
export function ipLimiters(): IpLimiters {
  store.__hrIpLimiters ??= {
    codeRequests: new MemoryLimiter(IP_LIMITS.codeRequests),
    codeChecks: new MemoryLimiter(IP_LIMITS.codeChecks),
  };
  return store.__hrIpLimiters;
}
