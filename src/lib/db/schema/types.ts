import { customType } from "drizzle-orm/pg-core";

/** Punto geografico WGS84 (PostGIS). Letto/scritto solo tramite SQL: nel codice usiamo lat/lon. */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography"; // senza modificatore: drizzle-kit quoterebbe "geography(Point,4326)"
  },
});

/** Vettore di ricerca full-text (configurazione `italian_unaccent`, vedi migrazione 0000). */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Testo cifrato a livello applicativo (formato `v1.<iv>.<tag>.<ct>`, ADR-0004).
 * Tipo distinto per rendere evidente nel codice che NON è testo in chiaro.
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return "text";
  },
});
