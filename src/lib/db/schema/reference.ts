import { sql } from "drizzle-orm";
import {
  char,
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { geographyPoint } from "./types";

/** Dati di riferimento pubblici (classe C0): regioni, province, comuni ISTAT, mansioni ESCO. */

export const regions = pgTable("regions", {
  code: char("code", { length: 2 }).primaryKey(), // codice ISTAT regione, es. "03" Lombardia
  name: text("name").notNull(),
});

export const provinces = pgTable("provinces", {
  code: char("code", { length: 3 }).primaryKey(), // codice ISTAT provincia/UTS, es. "016"
  name: text("name").notNull(),
  abbreviation: char("abbreviation", { length: 2 }).notNull(), // sigla, es. "BG"
  regionCode: char("region_code", { length: 2 })
    .notNull()
    .references(() => regions.code),
});

export const municipalities = pgTable(
  "municipalities",
  {
    istatCode: char("istat_code", { length: 6 }).primaryKey(),
    name: text("name").notNull(),
    provinceCode: char("province_code", { length: 3 })
      .notNull()
      .references(() => provinces.code),
    regionCode: char("region_code", { length: 2 })
      .notNull()
      .references(() => regions.code),
    population: integer("population"),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    // Centroide calcolato dal DB: usato da ST_DWithin per raggio e regola dei 50 km (ADR-0009).
    centroid: geographyPoint("centroid").generatedAlwaysAs(
      sql`(ST_SetSRID(ST_MakePoint(lon, lat), 4326))::geography`,
    ),
  },
  (t) => [
    index("municipalities_centroid_gist").using("gist", t.centroid),
    index("municipalities_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("municipalities_region_idx").on(t.regionCode),
  ],
);

export const occupations = pgTable(
  "occupations",
  {
    id: serial("id").primaryKey(),
    escoUri: text("esco_uri").unique(),
    iscoCode: varchar("isco_code", { length: 4 }),
    cp2021Code: varchar("cp2021_code", { length: 16 }),
    labelIt: text("label_it").notNull(),
    synonyms: text("synonyms")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    groupCode: varchar("group_code", { length: 4 }), // gruppo ISCO a 3 cifre: "mansioni affini" (ADR-0005)
  },
  (t) => [index("occupations_label_trgm").using("gin", sql`${t.labelIt} gin_trgm_ops`)],
);

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  escoUri: text("esco_uri").unique(),
  labelIt: text("label_it").notNull(),
});

/** R-LAV-10: indennità minima dei tirocini extracurricolari per regione (tabella curata a mano, con fonte). */
export const regionalInternshipMinimums = pgTable(
  "regional_internship_minimums",
  {
    regionCode: char("region_code", { length: 2 })
      .notNull()
      .references(() => regions.code),
    validFrom: date("valid_from").notNull(),
    monthlyMinEur: numeric("monthly_min_eur", { precision: 8, scale: 2 }).notNull(),
    sourceUrl: text("source_url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.regionCode, t.validFrom] })],
);
