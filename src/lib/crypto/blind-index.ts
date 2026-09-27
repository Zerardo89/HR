import { createHmac } from "node:crypto";

/**
 * Indice cieco (ADR-0004): permette di CERCARE un'email o un telefono senza salvarli in chiaro.
 * HMAC-SHA256 con una chiave separata dalla KEK; lo scopo (`purpose`) entra nel calcolo,
 * quindi lo stesso valore dà indici diversi per scopi diversi (niente correlazioni tra colonne).
 */
export type BlindIndexPurpose = "email" | "phone";

export function normalizeEmail(email: string): string {
  return email.normalize("NFC").trim().toLowerCase();
}

/** Solo cifre, con prefisso internazionale; i numeri italiani senza prefisso diventano +39. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+39${digits}`;
}

export function normalizeForIndex(value: string, purpose: BlindIndexPurpose): string {
  return purpose === "email" ? normalizeEmail(value) : normalizePhone(value);
}

/**
 * MAC con chiave (HMAC-SHA256) per valori che non si cercano ma si confrontano o si pseudonimizzano:
 * codici di accesso (`otp`) e indirizzi IP nel log di audit (`ip`). Stessa chiave dell'indice cieco,
 * ma con il prefisso `mac:` gli input non possono mai coincidere con quelli dell'indice (`email:`/`phone:`).
 */
export type MacPurpose = "otp" | "ip" | "recovery";

export function computeMac(key: Uint8Array, message: string, purpose: MacPurpose): string {
  return createHmac("sha256", key).update(`mac:${purpose}:${message}`, "utf8").digest("base64url");
}

export function computeBlindIndex(
  key: Uint8Array,
  value: string,
  purpose: BlindIndexPurpose,
): string {
  return createHmac("sha256", key)
    .update(`${purpose}:${normalizeForIndex(value, purpose)}`, "utf8")
    .digest("base64url");
}
