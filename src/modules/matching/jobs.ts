import "server-only";

// Modulo `matching` — API per i job del worker e per gli altri moduli che girano nel worker (WP-020).
// Niente componenti né Next.js: si importa fuori dal rendering. Dipendenze esplicite (DB, elenco mansioni, ora).
export {
  findCandidates,
  recognizeOccupation,
  type OccupationMatch,
  type SearchDeps,
  type SearchPlace,
} from "./server/search";
export {
  findOffersForProfile,
  type ProfileOffer,
  type ProfileOfferQuery,
} from "./server/profile-offers";
