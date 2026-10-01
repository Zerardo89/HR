import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce, STATIC_SECURITY_HEADERS } from "./security-headers";

// Test di accettazione WP-027 (docs/04 §6): header di sicurezza. NON modificarli per farli passare.

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split("; ").map((d) => {
      const [name, ...values] = d.split(" ");
      return [name!, values.join(" ")];
    }),
  );

describe("Content-Security-Policy", () => {
  it("script solo con nonce, niente inline né eval in produzione, niente frame né plugin", () => {
    const d = directives(contentSecurityPolicy("abc123", { dev: false, https: true }));
    expect(d["script-src"]).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(d["script-src"]).not.toContain("unsafe-inline");
    expect(d["object-src"]).toBe("'none'");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self'");
    expect(d["default-src"]).toBe("'self'");
    expect("upgrade-insecure-requests" in d).toBe(true);
    // WP-010: il service worker si registra solo dal nostro sito.
    expect(d["worker-src"]).toBe("'self'");
  });

  it("in sviluppo `unsafe-eval` per React; in http niente upgrade (romperebbe localhost)", () => {
    const d = directives(contentSecurityPolicy("n", { dev: true, https: false }));
    expect(d["script-src"]).toContain("'unsafe-eval'");
    expect("upgrade-insecure-requests" in d).toBe(false);
  });

  it("nonce diverso a ogni richiesta, 128 bit", () => {
    const a = newNonce();
    expect(a).not.toBe(newNonce());
    expect(Buffer.from(a, "base64")).toHaveLength(16);
  });
});

describe("header fissi", () => {
  it("nosniff, niente frame, referrer solo verso il nostro sito (i token delle email non escono)", () => {
    const h = Object.fromEntries(STATIC_SECURITY_HEADERS);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    // Non `no-referrer`: i POST dei form perderebbero l'Origin, che Next.js controlla contro il CSRF.
    expect(h["Referrer-Policy"]).toBe("same-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });
});
