import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

// Aiuti condivisi dagli e2e: posta di prova (Mailpit) e app di autenticazione simulata (TOTP, RFC 6238).

export const MAILPIT = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

export async function mailpitReachable(request: APIRequestContext): Promise<boolean> {
  return request
    .get(`${MAILPIT}/api/v1/info`, { timeout: 2000 })
    .then((r) => r.ok())
    .catch(() => false);
}

/** Codice a 6 cifre dell'email più recente per `to`, diversa da quelle già viste. */
export async function emailCode(
  request: APIRequestContext,
  to: string,
  seen: string[] = [],
): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT}/api/v1/search`, {
          params: { query: `to:"${to}"` },
        });
        const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
        const latest = messages[0];
        code =
          latest && !seen.includes(latest.ID) ? /\b(\d{6})\b/.exec(latest.Subject)?.[1] : undefined;
        if (code && latest) seen.push(latest.ID);
        return code !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return code!;
}

/** Come un'app di autenticazione: codice TOTP dalla chiave mostrata nella pagina (base32, a gruppi). */
export function authenticatorCode(key: string, offsetSeconds = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let acc = 0;
  const bytes: number[] = [];
  for (const ch of key.replace(/\s/g, "")) {
    acc = (acc << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((acc >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor((Date.now() / 1000 + offsetSeconds) / 30)));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export function newTestEmail(prefix: string): string {
  return `${prefix}+${randomUUID().slice(0, 8)}@esempio.it`;
}

/** Registrazione con il codice via email; per le aziende finisce sulla pagina della 2FA. */
export async function signUp(
  page: Page,
  request: APIRequestContext,
  email: string,
  tipo: "lavoratore" | "azienda",
  /** Email già lette per questo indirizzo (serve quando ci si registra di nuovo con la stessa email). */
  seen: string[] = [],
) {
  await page.goto(`/accedi?tipo=${tipo}`);
  await page.getByLabel("La tua email").fill(email);
  await page.getByRole("button", { name: "Ricevi il codice" }).click();
  await page.getByLabel("Codice di 6 cifre").fill(await emailCode(request, email, seen));
  await page.getByRole("button", { name: "Entra" }).click();
  await page.getByLabel("Ho almeno 18 anni").check();
  await page
    .getByLabel("Ho letto l'informativa sulla privacy e accetto le condizioni d'uso")
    .check();
  await page.getByRole("button", { name: "Crea l'account" }).click();
  // Aspetta che l'account sia creato (il cookie di sessione arriva con il reindirizzamento).
  await page.waitForURL(/\/account/);
}

/** Attiva la 2FA dalla pagina /account/sicurezza e restituisce la chiave (come l'avrebbe salvata l'app). */
export async function enableTwoFactor(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/account\/sicurezza$/);
  const key = (await page.getByLabel(/Inserisci a mano questa chiave/).textContent()) ?? "";
  await page.getByLabel("Codice dell'app (6 cifre)").fill(authenticatorCode(key));
  await page.getByRole("button", { name: "Attiva la verifica" }).click();
  await expect(
    page.getByRole("heading", { name: "Salva questi codici di recupero" }),
  ).toBeVisible();
  return key;
}

/** Un giro di un job del worker, come lo fa pg-boss (`pnpm worker --once <job>`), con la configurazione di prova. */
export function runWorkerJob(job: string, appUrl: string): void {
  execFileSync("pnpm", ["-s", "worker", "--once", job], {
    env: {
      ...process.env,
      APP_URL: appUrl,
      KEK_FILE: "./tests/fixtures/test-kek.b64",
      BLIND_INDEX_KEY_FILE: "./tests/fixtures/test-blind-index.b64",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      MAIL_FROM: "HR test <noreply@localhost>",
    },
    stdio: "pipe",
    timeout: 90_000,
  });
}

/**
 * Il comune di Lodi nel DB di prova. Chi lo cerca o lo scrive nel profilo lo prepara PRIMA: su un DB nuovo può
 * non esserci ancora (nessun altro test l'ha inserito, o la pulizia del test di import l'ha tolto).
 */
export async function seedLodi(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('098','Lodi','LO','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('098031','Lodi','098','03',45.3097,9.5037) on conflict do nothing`,
    );
  } finally {
    await pool.end();
  }
}
