import "server-only";
import { z } from "zod";
import { parseBoolean } from "@/lib/flags";
import { ANDROID_PACKAGE_RE, parseFingerprints } from "@/lib/pwa/asset-links";

/**
 * Variabili d'ambiente del server, validate con Zod.
 * La validazione avviene all'avvio del server (src/instrumentation.ts): se manca qualcosa l'app non parte.
 * I segreti (chiavi) NON stanno qui: si leggono da file (`*_FILE`, Docker secrets) — vedi ADR-0004.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    APP_VERSION: z.string().default("dev"),
    DATABASE_URL: z
      .url()
      .refine((u) => u.startsWith("postgres://") || u.startsWith("postgresql://"), {
        message: "DATABASE_URL deve essere un URL postgres://",
      }),
    KEK_FILE: z.string().min(1),
    BLIND_INDEX_KEY_FILE: z.string().min(1),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(3),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    // Intestazione con l'IP del visitatore, usata SOLO in memoria per i limiti di frequenza (ADR-0013).
    // Dietro Cloudflare Tunnel: `cf-connecting-ip`. Il server non ha porte aperte, quindi il valore è affidabile.
    // Servizio VIES della Commissione europea (verifica della P.IVA, WP-011). Irraggiungibile → azienda "in verifica".
    VIES_API_URL: z.url().default("https://ec.europa.eu/taxation_customs/vies/rest-api"),
    CLIENT_IP_HEADER: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("x-forwarded-for"),
    // Registro delle cancellazioni fuori dal DB (ADR-0014, WP-027): file su un volume del server, nei backup.
    ERASURE_LEDGER_FILE: z.string().min(1).optional(),
    // App Android (TWA, WP-010): nome del pacchetto e impronte SHA-256 dei certificati separate da virgole
    // (chiave di firma di Play e di caricamento). Tutte e due o nessuna: senza, `/.well-known/assetlinks.json`
    // risponde 404.
    ANDROID_PACKAGE_NAME: z.string().regex(ANDROID_PACKAGE_RE).optional(),
    ANDROID_CERT_SHA256: z
      .string()
      .refine((v) => {
        try {
          return parseFingerprints(v).length > 0;
        } catch {
          return false;
        }
      }, "impronte SHA-256 non valide (formato AA:BB:…, 32 byte, separate da virgole)")
      .optional(),
    // Anteprima (WP-010b): letto anche da `lib/flags`; qui serve solo per il controllo qui sotto.
    PREVIEW_MODE: z.string().optional(),
    // Codici invito dei tester, separati da virgole (genera con `pnpm preview:invite-code`). Stesse regole di
    // `parseInviteCodes` in `modules/identity/domain`: almeno 10 lettere o cifre, trattini e spazi ammessi.
    PREVIEW_INVITE_CODES: z
      .string()
      .refine(
        (v) =>
          v
            .split(",")
            .every((c) => /^[A-Z0-9]{10,64}$/.test(c.toUpperCase().replace(/[\s-]/g, ""))),
        "codici invito non validi (almeno 10 lettere o cifre ciascuno, separati da virgole)",
      )
      .optional(),
  })
  .refine((env) => !env.ANDROID_PACKAGE_NAME === !env.ANDROID_CERT_SHA256, {
    path: ["ANDROID_CERT_SHA256"],
    message: "ANDROID_PACKAGE_NAME e ANDROID_CERT_SHA256 vanno impostate insieme",
  })
  .refine((env) => !parseBoolean(env.PREVIEW_MODE) || Boolean(env.PREVIEW_INVITE_CODES), {
    path: ["PREVIEW_INVITE_CODES"],
    message:
      "obbligatoria con PREVIEW_MODE=true (in anteprima ci si registra solo con il codice invito)",
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Solo i NOMI delle variabili nel messaggio, mai i valori.
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configurazione non valida: ${problems}`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
