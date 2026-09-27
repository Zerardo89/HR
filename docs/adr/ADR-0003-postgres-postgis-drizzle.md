# ADR-0003 — PostgreSQL + PostGIS + Drizzle; ricerca e code dentro Postgres

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Servono: dati relazionali, ricerca testuale in italiano tollerante agli errori, distanze geografiche
(raggio, regola 50 km), job pianificati (email, conservazione), con **il minor numero di servizi da gestire**.

## Decisione
- **PostgreSQL 17 + PostGIS** (immagine `postgis/postgis`).
- **Drizzle ORM** per schema e query tipizzate, **drizzle-kit** per migrazioni SQL versionate e revisionate.
- Ricerca: `tsvector` con configurazione `italian` + `unaccent`, indice GIN; `pg_trgm` per suggerimenti e refusi.
- Geografia: centroidi dei comuni come `geography(Point,4326)`, `ST_DWithin` per raggio/50 km, indice GiST.
- Code e cron: **pg-boss** (tabelle nello stesso DB), con fuso `Europe/Rome`.

## Alternative scartate
- **Prisma**: molto noto ai modelli, ma supporto PostGIS scarso (tipi `Unsupported`, query raw) e cambi di configurazione recenti.
- **Elasticsearch/Meilisearch**: un servizio in più; inutile sotto le ~100k offerte.
- **Redis + BullMQ**: un servizio in più.
- **Tabella precalcolata delle distanze tra comuni**: fattibile (~1-5 mln righe) ma PostGIS è più semplice e flessibile.

## Conseguenze
- ✅ Un solo servizio dati, backup unico.
- ⚠️ I modelli locali conoscono Drizzle meno di Prisma: i WP includono esempi di schema e query già scritti dall'architetto.

## Verifica
Test di integrazione con Postgres reale (container) su: ricerca con refuso ("magazinniere"), raggio, regola di zona ai confini.

## Aggiornamento 26/09/2026 (WP-004)
- **Lo stemmer Snowball italiano non unifica singolare/plurale di molte mansioni** (verificato: "cameriere" → `camer`,
  "camerieri" → `camerier`; "magazziniere" → `magazzin`, "magazzinieri" → `magazzinier`). La ricerca testuale del WP-015
  deve quindi combinare **full-text** (`italian_unaccent`) **oppure** similarità a trigrammi sul titolo
  (`word_similarity ≥ 0,6`: cameriere/camerieri 0,80; cuoco/cuoca 0,67). Fissato in `tests/integration/schema.test.ts`.
  La via principale resta comunque la **mansione** (tassonomia con sinonimi, WP-006).
- Il centroide dei comuni è una colonna `geography` **generata** da `lat`/`lon` (drizzle-kit non gestisce il modificatore
  `(Point,4326)`); nel codice si usano sempre `lat`/`lon`.
- Distanze: sfera con raggio medio (`ST_DWithin(…, false)`) = stessa formula della funzione pura `distanceKm`; verificato.
