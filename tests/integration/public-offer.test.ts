import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { getPublicOffer, listLiveOfferIds } from "@/modules/offers/server/public-offer";
import { closePool, DATABASE_URL, inRollback, seedReference } from "./db";

// Test di accettazione WP-014 (pagina pubblica dell'offerta) sul DB reale. NON modificarli per farli passare.

const now = new Date("2026-11-10T09:00:00Z");
const DAY = 24 * 60 * 60_000;

async function company(c: PoolClient, status: "verified" | "pending" | "suspended") {
  const { rows } = await c.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status)
     values ($1, 'FINTA SRL', 'Trattoria Finta', $2) returning id`,
    [`8${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`, status],
  );
  return rows[0]!.id;
}

type OfferRow = {
  status: "draft" | "pending_review" | "published" | "expired" | "closed" | "removed";
  publishedDaysAgo?: number;
  validDays?: number;
};

async function offer(c: PoolClient, companyId: string, o: OfferRow) {
  const publishedAt =
    o.publishedDaysAgo != null ? new Date(now.getTime() - o.publishedDaysAgo * DAY) : null;
  const validThrough = publishedAt
    ? new Date(publishedAt.getTime() + (o.validDays ?? 30) * DAY)
    : null;
  const { rows } = await c.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, hours_per_week, status, salary_min, salary_max, salary_period, ccnl, published_at, valid_through)
     values ($1, 'Cameriere/a di sala', 9001, 'Servizio ai tavoli, pranzo e cena.', '015146', 'permanent',
       'part_time', 24, $2, 1200, 1350.5, 'month', 'Turismo', $3, $4) returning id`,
    [companyId, o.status, publishedAt, validThrough],
  );
  return rows[0]!.id;
}

describe.skipIf(!DATABASE_URL)("pagina pubblica dell'offerta (WP-014)", () => {
  afterAll(closePool);

  it("offerta pubblicata e valida: tutti i dati per la pagina e per JobPosting", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      const id = await offer(c, await company(c, "verified"), {
        status: "published",
        publishedDaysAgo: 2,
        validDays: 30,
      });
      const result = await getPublicOffer(drizzle(c), id, now);
      expect(result).toEqual({
        state: "live",
        offer: {
          id,
          title: "Cameriere/a di sala",
          description: "Servizio ai tavoli, pranzo e cena.",
          companyName: "Trattoria Finta",
          municipality: "Milano",
          provinceAbbr: "MI",
          contractType: "permanent",
          schedule: "part_time",
          hoursPerWeek: 24,
          salaryMin: 1200,
          salaryMax: 1350.5,
          salaryPeriod: "month",
          salaryBasis: "gross",
          ccnl: "Turismo",
          occupation: "Cameriere di sala",
          publishedAt: new Date(now.getTime() - 2 * DAY),
          validThrough: new Date(now.getTime() + 28 * DAY),
        },
      });
      expect((await listLiveOfferIds(drizzle(c), now)).map((o) => o.id)).toContain(id);
    });
  });

  it("scaduta (anche prima del job che cambia lo stato) o chiusa: solo il titolo, per dire che non c'è più", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      const companyId = await company(c, "verified");
      const lapsed = await offer(c, companyId, {
        status: "published",
        publishedDaysAgo: 40,
        validDays: 30,
      });
      const expired = await offer(c, companyId, { status: "expired", publishedDaysAgo: 40 });
      const closed = await offer(c, companyId, { status: "closed", publishedDaysAgo: 5 });
      for (const id of [lapsed, expired, closed]) {
        expect(await getPublicOffer(drizzle(c), id, now)).toEqual({
          state: "gone",
          title: "Cameriere/a di sala",
        });
      }
      const live = (await listLiveOfferIds(drizzle(c), now)).map((o) => o.id);
      expect(live).not.toContain(lapsed);
      expect(live).not.toContain(expired);
      expect(live).not.toContain(closed);
    });
  });

  it("bozza, in moderazione, rimossa, azienda non verificata o sospesa, id inesistente: 404", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      const verified = await company(c, "verified");
      const hidden = [
        await offer(c, verified, { status: "draft" }),
        await offer(c, verified, { status: "pending_review" }),
        await offer(c, verified, { status: "removed", publishedDaysAgo: 3 }),
        await offer(c, await company(c, "pending"), { status: "published", publishedDaysAgo: 1 }),
        await offer(c, await company(c, "suspended"), { status: "published", publishedDaysAgo: 1 }),
        await offer(c, await company(c, "suspended"), { status: "closed", publishedDaysAgo: 1 }),
      ];
      for (const id of hidden) {
        expect(await getPublicOffer(drizzle(c), id, now)).toBeNull();
      }
      expect(
        await getPublicOffer(drizzle(c), "00000000-0000-4000-8000-000000000000", now),
      ).toBeNull();
      const live = (await listLiveOfferIds(drizzle(c), now)).map((o) => o.id);
      for (const id of hidden) expect(live).not.toContain(id);
    });
  });
});
