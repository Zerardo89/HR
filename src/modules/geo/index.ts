// Modulo `geo` — API pubblica (lato server).
// Comuni ISTAT, regioni, province, distanze. Parte pura in `./domain`.
export { importMunicipalities, type ImportSummary } from "./server/import-municipalities";
export { listProvinces, type ProvinceOption } from "./server/provinces";
