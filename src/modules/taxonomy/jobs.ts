import "server-only";

// Modulo `taxonomy` — API per i job del worker (WP-020): niente componenti né Next.js.
export { getOccupationCatalog, type OccupationCatalog } from "./server/catalog";
