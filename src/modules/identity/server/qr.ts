import "server-only";
import QRCode from "qrcode";

/** Moduli bianchi attorno al QR (standard ISO/IEC 18004): senza, alcune fotocamere non lo leggono. */
const QUIET_ZONE = 4;

/**
 * QR come percorso SVG (un quadratino per modulo scuro), da disegnare in un `<path>` di React:
 * niente HTML iniettato nella pagina. `size` include il margine bianco.
 */
export function qrSvgPath(text: string): { size: number; path: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size: modules.size + 2 * QUIET_ZONE, path };
}
