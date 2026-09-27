import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { formatOtp } from "../domain";

/** Token di sessione o di registrazione: 256 bit casuali. Nel DB va solo `hashToken(token)`. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 basta (senza chiave): il token ha 256 bit di entropia, non si indovina partendo dall'hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function newOtpCode(): string {
  return formatOtp(randomInt(0, 1_000_000));
}

/** Confronto a tempo costante (non rivela quanti caratteri coincidono). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
