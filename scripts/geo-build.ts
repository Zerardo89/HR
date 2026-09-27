/**
 * Costruisce data/municipalities.csv dall'elenco ufficiale ISTAT + un file di coordinate (vedi data/README.md).
 * Uso: pnpm geo:build --istat <file.csv> --coords <file.csv> [--istat-encoding latin1] [--out data/municipalities.csv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildFromIstat, toNormalizedCsv } from "../src/modules/geo/domain";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (!v) {
    console.error(`Parametro mancante: --${name}`);
    process.exit(1);
  }
  return v;
}

const istatPath = arg("istat");
const coordsPath = arg("coords");
const encoding = arg("istat-encoding", "latin1") as BufferEncoding; // i CSV ISTAT sono spesso in Windows-1252
const out = arg("out", "data/municipalities.csv");

const report = buildFromIstat(readFileSync(istatPath, encoding), readFileSync(coordsPath, "utf8"));
writeFileSync(out, toNormalizedCsv(report.rows), "utf8");

console.log(`Comuni scritti: ${report.rows.length} → ${out}`);
if (report.missingCoordinates.length > 0) {
  console.warn(
    `⚠️  ${report.missingCoordinates.length} comuni senza coordinate (esclusi):`,
    report.missingCoordinates.slice(0, 20).join(", "),
  );
}
if (report.unusedCoordinates.length > 0) {
  console.warn(
    `ℹ️  ${report.unusedCoordinates.length} coordinate di comuni non presenti nell'elenco ISTAT (es. fusioni).`,
  );
}
