import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token monouso (sessioni, registrazione, link nelle email): 256 bit casuali. Nel DB va solo `hashToken(token)`. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 basta (senza chiave): il token ha 256 bit di entropia, non si indovina partendo dall'hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

/** Forma di un token prodotto da `newToken` (43 caratteri base64url): scarta subito l'input sbagliato. */
export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Confronto a tempo costante (non rivela quanti caratteri coincidono). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
