import { expect, test, type Page } from "@playwright/test";
import { mailpitReachable, newTestEmail, signUp } from "./helpers";

// Test di accettazione WP-027 (docs/04 §6): header di sicurezza e CSP con nonce che non rompe l'app.

function cspViolations(page: Page): string[] {
  const found: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) {
      found.push(m.text());
    }
  });
  page.on("pageerror", (e) => found.push(e.message));
  return found;
}

test("pagine: CSP con nonce diverso a ogni richiesta e header di sicurezza", async ({
  request,
}) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const csp = first.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(second.headers()["content-security-policy"]).not.toBe(csp);
  expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect(first.headers()["referrer-policy"]).toBe("same-origin");
  expect(first.headers()["x-powered-by"]).toBeUndefined();
});

test("API: gli header fissi valgono anche lì", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBe("same-origin");
});

test("con la CSP gli script dell'app girano e nessuna risorsa è bloccata", async ({ page }) => {
  const violations = cspViolations(page);
  for (const path of ["/", "/offerte", "/accedi", "/condizioni", "/segnalazioni", "/contatti"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("con la CSP i componenti interattivi funzionano (autocompletamento delle mansioni)", async ({
  page,
  request,
}) => {
  test.skip(
    (!(await mailpitReachable(request)) || !process.env.DATABASE_URL) && !process.env.CI,
    "Servono Mailpit e DATABASE_URL",
  );
  const violations = cspViolations(page);
  await signUp(page, request, newTestEmail("csp"), "lavoratore");
  await page.goto("/profilo");
  // Le proposte compaiono solo se React ha preso il controllo della pagina (script con il nonce).
  await page.getByRole("combobox", { name: "Mansione principale" }).fill("barman");
  await expect(page.getByRole("option", { name: /^Barista/ })).toBeVisible();
  expect(violations).toEqual([]);
});
