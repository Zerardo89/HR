import { expect, test, type Page } from "@playwright/test";
import it from "../../messages/it.json";

// Test di accettazione WP-010: sito installabile come app (PWA), pagina offline, assetlinks per la TWA.
// Il nome dell'app viene da messages/it.json: può ancora cambiare (docs/09-DOMANDE-APERTE.md, Q1).
const SITE_NAME = it.meta.siteName;

/** Larghezza e altezza di un PNG (intestazione IHDR). */
function pngSize(body: Buffer): string {
  return `${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`;
}

async function waitForServiceWorker(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

test("installabile: manifest con nome, avvio senza barra e icone delle misure dichiarate", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    short_name: SITE_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "it",
  });
  expect(manifest.name).toContain(SITE_NAME);

  const icons: { src: string; sizes: string; purpose: string }[] = manifest.icons;
  expect(icons.map((i) => `${i.sizes} ${i.purpose}`).sort()).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(pngSize(await res.body())).toBe(icon.sizes);
  }
});

test("il nome dell'app è nel titolo e nell'intestazione, con l'icona nella scheda", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(new RegExp(`^${SITE_NAME}`));
  await expect(page.getByRole("link", { name: SITE_NAME })).toBeVisible();
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(icon).toMatch(/^\/icon/);
});

test("senza connessione l'app mostra 'Sei offline' e si riprende col tasto Riprova", async ({
  page,
  context,
}) => {
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.goto("/come-funziona");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sei offline");

  await context.setOffline(false);
  await page.getByRole("link", { name: "Riprova" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Sei offline");
  await expect(page).toHaveURL(/\/come-funziona$/);
});

test("server di casa spento (Cloudflare risponde 530): pagina 'Servizio non raggiungibile'", async ({
  page,
  context,
}) => {
  await waitForServiceWorker(page);
  await context.route("**/chi-siamo", (route) =>
    route.fulfill({ status: 530, body: "error 1033" }),
  );
  await page.goto("/chi-siamo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Servizio non raggiungibile");
});

// Dentro l'app i link di Next.js non ricaricano la pagina (richieste RSC, non "navigate"): se la richiesta
// fallisce, Next.js ripiega su una navigazione completa, che passa dal service worker.
test("già dentro l'app, senza connessione un link porta a 'Sei offline'", async ({
  page,
  context,
}) => {
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.getByRole("link", { name: "Cerca lavoro" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sei offline");
  await context.setOffline(false);
});

test("già dentro l'app, con il server di casa spento un link porta a 'Servizio non raggiungibile'", async ({
  page,
  context,
}) => {
  await waitForServiceWorker(page);
  await context.route(/\/accedi(\?|$)/, (route) =>
    route.fulfill({ status: 530, body: "error 1033" }),
  );
  await page.getByRole("link", { name: "Accedi o registrati" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Servizio non raggiungibile");
});

test("il service worker non salva pagine né dati sul telefono", async ({ page }) => {
  await waitForServiceWorker(page);
  await page.goto("/offerte");
  const cached = await page.evaluate(async () => (await caches.keys()).length);
  expect(cached).toBe(0);
});

// Il caso "app non configurata → 404" è nei test unitari (src/lib/pwa/asset-links.test.ts): qui il sito gira
// con il pacchetto e l'impronta di prova di playwright.config.ts.
test("assetlinks.json per l'app Android: JSON diretto, senza redirect", async ({ request }) => {
  const res = await request.get("/.well-known/assetlinks.json", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  const [link] = await res.json();
  expect(link.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
  expect(link.target.package_name).toBe("cloud.inspectio.e2e");
  expect(link.target.sha256_cert_fingerprints).toHaveLength(1);
});
