import { expect, test } from "@playwright/test";

test("la home è in italiano e mostra il titolo", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Il lavoro vicino a casa");
});

test("il link 'Vai al contenuto' porta al contenuto principale (accessibilità)", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Vai al contenuto" })).toBeFocused();
});

test("l'endpoint di stato non espone dettagli interni", async ({ request }) => {
  const res = await request.get("/api/health");
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(["db", "status", "version"]);
});
