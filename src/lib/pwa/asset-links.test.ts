import { describe, expect, it } from "vitest";
import {
  ANDROID_PACKAGE_RE,
  androidAssetLinks,
  assetLinks,
  parseFingerprints,
} from "./asset-links";

// Test di accettazione WP-010: assetlinks.json per l'app Android (TWA).

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0")).join(":");

describe("impronte SHA-256 dei certificati", () => {
  it("accetta più impronte separate da virgole e le porta in maiuscolo", () => {
    expect(parseFingerprints(` ${FP} , ${FP.toUpperCase()}`)).toEqual([
      FP.toUpperCase(),
      FP.toUpperCase(),
    ]);
  });

  it("rifiuta impronte corte, SHA-1 o vuote, anche una virgola di troppo", () => {
    expect(() => parseFingerprints("")).toThrow();
    expect(() => parseFingerprints(FP.slice(0, -3))).toThrow();
    expect(() => parseFingerprints(FP.replaceAll(":", ""))).toThrow();
    expect(() => parseFingerprints(`${FP},`)).toThrow();
    expect(() => parseFingerprints(`${FP},,${FP}`)).toThrow();
  });
});

describe("app Android non configurata", () => {
  it("senza pacchetto o senza impronte non c'è il file (404)", () => {
    expect(androidAssetLinks({})).toBeNull();
    expect(androidAssetLinks({ ANDROID_PACKAGE_NAME: "cloud.inspectio.tasky" })).toBeNull();
    expect(androidAssetLinks({ ANDROID_CERT_SHA256: FP })).toBeNull();
    expect(
      androidAssetLinks({ ANDROID_PACKAGE_NAME: "cloud.inspectio.tasky", ANDROID_CERT_SHA256: FP }),
    ).toHaveLength(1);
  });
});

describe("assetlinks.json", () => {
  it("delega all'app tutti gli indirizzi del sito", () => {
    expect(assetLinks("cloud.inspectio.tasky", [FP])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "cloud.inspectio.tasky",
          sha256_cert_fingerprints: [FP],
        },
      },
    ]);
  });

  it("nome del pacchetto in formato Android (almeno due parti, minuscole)", () => {
    expect(ANDROID_PACKAGE_RE.test("cloud.inspectio.tasky")).toBe(true);
    expect(ANDROID_PACKAGE_RE.test("tasky")).toBe(false);
    expect(ANDROID_PACKAGE_RE.test("Cloud.Inspectio")).toBe(false);
    expect(ANDROID_PACKAGE_RE.test("cloud..tasky")).toBe(false);
  });
});
