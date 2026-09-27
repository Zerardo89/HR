import "server-only";
import { z } from "zod";

/**
 * Variabili d'ambiente del server, validate con Zod.
 * La validazione avviene all'avvio del server (src/instrumentation.ts): se manca qualcosa l'app non parte.
 * I segreti (chiavi) NON stanno qui: si leggono da file (`*_FILE`, Docker secrets) — vedi ADR-0004.
 */
const serverEnvSchema = z.object({
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
