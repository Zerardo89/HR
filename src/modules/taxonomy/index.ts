// Modulo `taxonomy` — API pubblica (lato server).
// Mansioni (elenco curato con codici ISCO-08, sinonimi, ricerca). Parte pura in `./domain`.
export { getOccupationCatalog, type OccupationCatalog } from "./server/catalog";
export { importOccupations, type OccupationImportSummary } from "./server/import-occupations";
export { OccupationPicker } from "./ui/occupation-picker";
