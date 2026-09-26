import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import {
  buildFromIstat,
  parseNormalizedMunicipalities,
  toNormalizedCsv,
} from "./municipalities-data";

// Test di accettazione WP-005 (import comuni). NON modificarli per far passare il codice.

const sample = readFileSync("tests/fixtures/municipalities-sample.csv", "utf8");

describe("parser CSV", () => {
  it("gestisce virgolette, virgolette raddoppiate, separatore nel campo, CRLF e BOM", () => {
    const text = '﻿a;b;c\r\n"Reggio nell\'Emilia";"x;y";"dice ""ciao"""\r\n';
    expect(parseCsv(text, ";")).toEqual([
      ["a", "b", "c"],
      ["Reggio nell'Emilia", "x;y", 'dice "ciao"'],
    ]);
  });
});

describe("CSV normalizzato dei comuni", () => {
  it("il campione verificato si legge senza errori", () => {
    const { rows, errors } = parseNormalizedMunicipalities(sample);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.istat_code === "033032")).toMatchObject({
      name: "Piacenza",
      province_abbr: "PC",
      region_code: "08",
    });
  });

  it("scarta coordinate fuori dall'Italia (es. lat/lon invertite), codici non validi e duplicati", () => {
    const header = sample.split("\n")[0];
    const bad = [
      header,
      "015146,Milano,015,MI,Milano,03,Lombardia,9.19,45.46,", // invertite
      "12345,Corto,015,MI,Milano,03,Lombardia,45.4,9.1,", // codice di 5 cifre
      "098031,Lodi,098,LO,Lodi,03,Lombardia,45.3097,9.5037,",
      "098031,Lodi,098,LO,Lodi,03,Lombardia,45.3097,9.5037,", // duplicato
    ].join("\n");
    const { rows, errors } = parseNormalizedMunicipalities(bad);
    expect(rows.map((r) => r.istat_code)).toEqual(["098031"]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5]);
  });

  it("round-trip: toNormalizedCsv → parse restituisce le stesse righe (anche con virgole nei nomi)", () => {
    const { rows } = parseNormalizedMunicipalities(sample);
    const withComma = [...rows, { ...rows[0]!, istat_code: "999999", name: "Nome, con virgola" }];
    expect(parseNormalizedMunicipalities(toNormalizedCsv(withComma)).rows).toEqual(withComma);
  });
});

describe("costruzione dall'elenco ISTAT", () => {
  const istat = [
    '"Codice Regione";"Codice dell\'Unità territoriale sovracomunale (valida a fini statistici)";"Codice Comune formato alfanumerico";"Denominazione in italiano";"Denominazione Regione";"Denominazione dell\'Unità territoriale sovracomunale (valida a fini statistici)";"Sigla automobilistica"',
    '"03";"098";"098031";"Lodi";"Lombardia";"Lodi";"LO"',
    '"08";"033";"033032";"Piacenza";"Emilia-Romagna";"Piacenza";"PC"',
    '"03";"098";"098062";"Comune Nuovo da Fusione";"Lombardia";"Lodi";"LO"',
  ].join("\n");
  const coords = "codice,lat,lon\n98031,45.3097,9.5037\n33032,45.0526,9.6934\n99999,45.0,9.0\n";

  it("unisce codici e coordinate (anche senza zeri iniziali) e segnala i mancanti", () => {
    const report = buildFromIstat(istat, coords);
    expect(report.rows.map((r) => r.istat_code)).toEqual(["098031", "033032"]);
    expect(report.rows[1]).toMatchObject({
      province_code: "033",
      province_abbr: "PC",
      region_code: "08",
      lat: 45.0526,
    });
    expect(report.missingCoordinates).toEqual(["098062"]);
    expect(report.unusedCoordinates).toEqual(["099999"]);
  });

  it("se le intestazioni ISTAT cambiano, l'errore elenca quelle trovate", () => {
    expect(() => buildFromIstat("a;b\n1;2", coords)).toThrow(/Intestazioni presenti: a \| b/);
  });
});
