import "server-only";
import QRCode from "qrcode";
import { startTotpEnrollment } from "./mfa";
import { runtimeDeps } from "./runtime";

export type TotpEnrollmentView =
  | { status: "pending"; uri: string; qrDataUrl: string; keyGroups: string[] }
  | { status: "already_enabled" };

/** Dati per la pagina di attivazione: QR code (PNG in data URL), link otpauth e chiave a gruppi di 4. */
export async function getTotpEnrollment(userId: string): Promise<TotpEnrollmentView> {
  const start = await startTotpEnrollment(runtimeDeps(), userId);
  if (start.status !== "pending") return start;
  const qrDataUrl = await QRCode.toDataURL(start.uri, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
  return {
    status: "pending",
    uri: start.uri,
    qrDataUrl,
    keyGroups: start.secretBase32.match(/.{1,4}/g) ?? [],
  };
}
