import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

// Test di accettazione WP-014: pagina pubblica dell'offerta (SSR), JSON-LD JobPosting, sitemap e robots.
// Preparazione nel DB di prova: un'azienda verificata con un'offerta pubblicata, una chiusa e una bozza.

type Seeded = { live: string; closed: string; draft: string; title: string };

async function seedOffers(): Promise<Seeded> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('015','Milano','MI','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('015146','Milano','015','03',45.4642,9.1900) on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(`select id from occupations order by id limit 1`);
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Osteria Finta', 'verified', now()) returning id`,
      [`5${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    const title = `Addetto/a mensa ${randomInt(0, 1e6)}`;
    const insert = (status: string, published: boolean) =>
      pool.query<{ id: string }>(
        `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
           schedule, status, salary_min, salary_max, salary_period, ccnl, published_at, valid_through)
         values ($1, $2, $3, $4, '015146', 'permanent', 'full_time', $5, 1600, 1800, 'month', 'Turismo',
           ${published ? "now() - interval '1 day', now() + interval '29 days'" : "null, null"})
         returning id`,
        [
          company.rows[0]!.id,
          title,
          occ.rows[0]!.id,
          "Primi e secondi di mare.\nTurni serali dal martedì alla domenica. <b>niente html</b>",
          status,
        ],
      );
    const live = (await insert("published", true)).rows[0]!.id;
    const closed = (await insert("closed", true)).rows[0]!.id;
    const draft = (await insert("draft", false)).rows[0]!.id;
    return { live, closed, draft, title };
  } finally {
    await pool.end();
  }
}

test.describe("pagina pubblica dell'offerta", () => {
  let seeded: Seeded;

  test.beforeAll(async () => {
    test.skip(!process.env.DATABASE_URL && !process.env.CI, "Serve DATABASE_URL");
    seeded = await seedOffers();
  });

  test("offerta pubblicata: dati in chiaro, stipendio e JobPosting per Google", async ({
    page,
  }) => {
    const response = await page.goto(`/offerte/${seeded.live}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: seeded.title })).toBeVisible();
    await expect(page.getByText("Osteria Finta")).toBeVisible();
    await expect(page.getByText(/Da 1600\s€ a 1800\s€ lordi al mese/)).toBeVisible();
    await expect(page.getByText("<b>niente html</b>", { exact: false })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${seeded.title} a Milano`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/offerte/${seeded.live}$`),
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const jsonLd = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: seeded.title,
      employmentType: ["FULL_TIME"],
      hiringOrganization: { "@type": "Organization", name: "Osteria Finta" },
      jobLocation: {
        "@type": "Place",
        address: { addressLocality: "Milano", addressRegion: "MI", addressCountry: "IT" },
      },
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "EUR",
        value: { "@type": "QuantitativeValue", minValue: 1600, maxValue: 1800, unitText: "MONTH" },
      },
    });
    // Nessun "<" dentro il tag script: la descrizione non può chiuderlo (serializeJsonLd).
    expect(raw).not.toContain("<");
  });

  test("offerta chiusa: la pagina lo dice e non si indicizza", async ({ page }) => {
    await page.goto(`/offerte/${seeded.closed}`);
    await expect(page.getByRole("heading", { level: 1, name: seeded.title })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("non è più disponibile");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test("bozza e indirizzi non validi: 404", async ({ page }) => {
    expect((await page.goto(`/offerte/${seeded.draft}`))?.status()).toBe(404);
    expect((await page.goto("/offerte/non-un-id"))?.status()).toBe(404);
  });

  test("sitemap con l'offerta pubblicata (non la chiusa) e robots che esclude le aree private", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/offerte/${seeded.live}</loc>`);
    expect(sitemap).not.toContain(seeded.closed);
    expect(sitemap).not.toContain(seeded.draft);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /account");
    expect(robots).toContain("Disallow: /moderazione");
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });
});
