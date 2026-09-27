// API pura del modulo taxonomy (mansioni).
export {
  buildTermIndex,
  normalizeTerm,
  OCCUPATION_CATEGORIES,
  parseOccupationsCsv,
  type Occupation,
  type OccupationCategory,
  type OccupationsParseResult,
} from "./occupations-data";
export {
  DEFAULT_LIMIT,
  MIN_QUERY_LENGTH,
  prepareCatalog,
  searchOccupations,
  type CatalogEntry,
  type PreparedCatalog,
  type SearchHit,
} from "./search";
