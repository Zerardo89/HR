/**
 * Digital Asset Links (WP-010, ADR-0002): il file `/.well-known/assetlinks.json` dice ad Android che l'app TWA e il
 * sito sono dello stesso proprietario, così l'app si apre senza barra degli indirizzi.
 * Le impronte sono quelle dei certificati: la chiave di firma di Play (Play App Signing) e, per i test
 * installati a mano, la chiave di caricamento.
 */

export const ANDROID_PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const SHA256_FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * "AA:BB:…, cc:dd:…" → impronte in maiuscolo. Lancia un errore se una voce non è un'impronta SHA-256
 * (anche le voci vuote, es. una virgola di troppo: un errore di configurazione non deve passare inosservato).
 */
export function parseFingerprints(value: string): string[] {
  const list = value.split(",").map((f) => f.trim().toUpperCase());
  for (const f of list) {
    if (!SHA256_FINGERPRINT_RE.test(f)) throw new Error("impronta SHA-256 non valida");
  }
  return list;
}

/** Contenuto di `/.well-known/assetlinks.json`, oppure `null` (→ 404) se l'app Android non è configurata. */
export function androidAssetLinks(env: {
  ANDROID_PACKAGE_NAME?: string;
  ANDROID_CERT_SHA256?: string;
}): ReturnType<typeof assetLinks> | null {
  if (!env.ANDROID_PACKAGE_NAME || !env.ANDROID_CERT_SHA256) return null;
  return assetLinks(env.ANDROID_PACKAGE_NAME, parseFingerprints(env.ANDROID_CERT_SHA256));
}

export function assetLinks(packageName: string, fingerprints: string[]) {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
