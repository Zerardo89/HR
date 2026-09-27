import { afterAll, describe, expect, it } from "vitest";
import { distanceKm } from "@/modules/geo/domain";
import { isInFreeZone } from "@/modules/matching/domain";
import { closePool, DATABASE_URL, expectDbError, inRollback, seedReference } from "./db";

// Test di accettazione WP-004 / WP-005 sul DB reale. Scritti dall'architetto: NON modificarli per farli passare.

afterAll(closePool);

describe.skipIf(!DATABASE_URL)("schema v1 (WP-004)", () => {
  it("nessuna colonna vietata o in chiaro per dati personali (R-LAV-05, R-ANN-02, R-PRIV-02)", async () => {
    const forbidden = [
      "email",
      "phone",
      "first_name",
      "last_name",
      "full_name",
      "birth_date",
      "date_of_birth",
      "age",
      "gender",
      "sex",
      "nationality",
      "photo",
      "photo_url",
      "marital_status",
      "religion",
      "previous_salary",
      "current_salary",
      "last_salary",
      "tax_code",
      "codice_fiscale",
    ];
    const rows = await inRollback(async (c) => {
      const res = await c.query<{ table_name: string; column_name: string }>(
        `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and column_name = any($1::text[])`,
        [forbidden],
      );
      return res.rows;
    });
    expect(rows).toEqual([]);
  });

  it("audit_log è append-only: UPDATE, DELETE e TRUNCATE falliscono", async () => {
    await inRollback(async (c) => {
      await c.query(
        `insert into audit_log (actor_id, action, target_table, target_id, purpose)
         values ('system:test','pii.decrypt','users','x','test')`,
      );
      expect(await expectDbError(c, `update audit_log set action = 'altro'`)).toMatchObject({
        code: "42501",
      });
      expect(await expectDbError(c, `delete from audit_log`)).toMatchObject({ code: "42501" });
      expect(await expectDbError(c, `truncate audit_log`)).toMatchObject({ code: "42501" });
    });
  });

  it("R-ANN-01: un'offerta di lavoro subordinato non si pubblica senza stipendio", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      const { rows } = await c.query<{ id: string }>(
        `insert into companies (vat_number, legal_name, display_name, status)
         values ('00000000000','Azienda Finta Srl','Azienda Finta','verified') returning id`,
      );
      const companyId = rows[0]!.id;
      const base = `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code,
        contract_type, schedule, status, published_at, valid_through, salary_min, salary_period)
        values ($1, 'Cameriere', 9001, 'Servizio in sala', '033032', $2, 'full_time', $3, now(), now() + interval '30 days', $4, $5)`;

      const noSalary = await expectDbError(c, base, [
        companyId,
        "permanent",
        "published",
        null,
        null,
      ]);
      expect(noSalary?.constraint).toBe("job_offers_salary_required");

      const draft = await expectDbError(c, base, [companyId, "permanent", "draft", null, null]);
      expect(draft).toBeNull(); // in bozza si può salvare senza stipendio

      const ok = await expectDbError(c, base, [companyId, "permanent", "published", 1400, "month"]);
      expect(ok).toBeNull();

      const selfEmployed = await expectDbError(c, base, [
        companyId,
        "self_employed",
        "published",
        null,
        null,
      ]);
      expect(selfEmployed).toBeNull(); // non subordinato: D.Lgs. 96/2026 non si applica
    });
  });

  it("R-ANN-07: scadenza obbligatoria entro 60 giorni dalla pubblicazione", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      const { rows } = await c.query<{ id: string }>(
        `insert into companies (vat_number, legal_name, display_name) values ('00000000001','X Srl','X') returning id`,
      );
      const err = await expectDbError(
        c,
        `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
          schedule, status, published_at, valid_through, salary_min, salary_period)
         values ($1,'Cameriere',9001,'x','033032','permanent','full_time','published', now(), now() + interval '61 days', 1400, 'month')`,
        [rows[0]!.id],
      );
      expect(err?.constraint).toBe("job_offers_valid_through");
    });
  });

  it("R-LAV-03: un'agenzia per il lavoro deve indicare l'autorizzazione", async () => {
    await inRollback(async (c) => {
      const err = await expectDbError(
        c,
        `insert into companies (vat_number, legal_name, display_name, kind) values ('00000000002','APL Srl','APL','agency')`,
      );
      expect(err?.constraint).toBe("companies_agency_authorization");
    });
  });

  it("ricerca in italiano: accenti ignorati; singolare/plurale e maschile/femminile trovati", async () => {
    // Lo stemmer Snowball italiano NON unifica molte mansioni (cameriere → "camer", camerieri → "camerier").
    // Strategia fissata qui e da usare nel WP-015: full-text OPPURE similarità a trigrammi sul titolo (≥ 0,6).
    await inRollback(async (c) => {
      await seedReference(c);
      const { rows } = await c.query<{ id: string }>(
        `insert into companies (vat_number, legal_name, display_name) values ('00000000003','Bar Srl','Bar') returning id`,
      );
      await c.query(
        `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type, schedule)
         values ($1, 'Barista caffè e camerieri', 9001, 'Cerchiamo personale per la città', '033032', 'seasonal', 'part_time'),
                ($1, 'Aiuto cuoca', 9001, 'Cucina tradizionale', '033032', 'seasonal', 'part_time')`,
        [rows[0]!.id],
      );
      const hits = async (q: string) =>
        (
          await c.query(
            `select count(*)::int as n from job_offers
             where search_tsv @@ plainto_tsquery('italian_unaccent', $1)
                or word_similarity(unaccent($1), unaccent(title)) >= 0.6`,
            [q],
          )
        ).rows[0].n;
      expect(await hits("caffe")).toBe(1);
      expect(await hits("citta")).toBe(1);
      expect(await hits("cameriere")).toBe(1);
      expect(await hits("cuoco")).toBe(1);
      expect(await hits("idraulico")).toBe(0);
    });
  });
});

describe.skipIf(!DATABASE_URL)(
  "geografia: SQL e dominio danno lo stesso risultato (WP-005)",
  () => {
    it("ST_DWithin su sfera coincide con distanceKm/isInFreeZone", async () => {
      await inRollback(async (c) => {
        await seedReference(c);
        const coords = {
          "015146": { lat: 45.4642, lon: 9.19 },
          "098031": { lat: 45.3097, lon: 9.5037 },
          "033032": { lat: 45.0526, lon: 9.6934 },
        } as const;
        const { rows } = await c.query<{ code: string; km: number; within: boolean }>(
          `select m.istat_code as code,
                ST_Distance(p.centroid, m.centroid, false) / 1000 as km,
                ST_DWithin(p.centroid, m.centroid, 50000, false) as within
         from municipalities m, municipalities p where p.istat_code = '033032'`,
        );
        const piacenza = {
          municipalityCode: "033032",
          regionCode: "08",
          approved: true,
          location: coords["033032"],
        };
        for (const r of rows) {
          const loc = coords[r.code as keyof typeof coords];
          expect(r.km).toBeCloseTo(distanceKm(coords["033032"], loc), 3);
          const regionCode = r.code === "033032" ? "08" : "03";
          const sameRegion = regionCode === "08";
          expect(sameRegion || r.within).toBe(
            isInFreeZone([piacenza], { municipalityCode: r.code, regionCode, location: loc }),
          );
        }
      });
    });

    it("il centroide è generato dal DB a partire da lat/lon", async () => {
      await inRollback(async (c) => {
        await seedReference(c);
        const { rows } = await c.query(
          `select ST_Y(centroid::geometry) as lat, ST_X(centroid::geometry) as lon from municipalities where istat_code = '098031'`,
        );
        expect(rows[0]).toEqual({ lat: 45.3097, lon: 9.5037 });
      });
    });
  },
);
