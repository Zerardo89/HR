// API pura del modulo geo (utilizzabile dal `domain/` di altri moduli).
export { distanceKm, isValidLatLon, EARTH_MEAN_RADIUS_KM, type LatLon } from "./distance";
export { csvToRecords, parseCsv } from "./csv";
export {
  buildFromIstat,
  isInItaly,
  municipalityRowSchema,
  parseNormalizedMunicipalities,
  toNormalizedCsv,
  type BuildReport,
  type MunicipalityRow,
  type ParseResult,
} from "./municipalities-data";
export { normalizePlaceName, parsePlaceText } from "./place-text";
