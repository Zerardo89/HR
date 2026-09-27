-- 0000 — Estensioni e configurazione della ricerca in italiano (ADR-0003).
-- Scritta a mano: deve precedere le tabelle (colonne generate e indici le usano).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
-- Configurazione full-text "italiano senza accenti": "perché" = "perche", "città" = "citta".
-- Specificando la configurazione, to_tsvector('italian_unaccent', …) è IMMUTABLE e utilizzabile
-- nelle colonne generate (job_offers.search_tsv).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'italian_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION italian_unaccent (COPY = italian);
    ALTER TEXT SEARCH CONFIGURATION italian_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, italian_stem;
  END IF;
END
$$;
