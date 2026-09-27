# Dati di riferimento

I file grandi di dati di terzi **non** sono nel repository: si generano in locale con gli script e si importano nel DB.
Nel repo c'è solo un piccolo campione verificato per i test (`tests/fixtures/municipalities-sample.csv`).

## Comuni (WP-005)

Formato normalizzato atteso da `pnpm geo:import` → `data/municipalities.csv` (UTF-8, separatore `,`):
`istat_code,name,province_code,province_abbr,province_name,region_code,region_name,lat,lon,population`

### Fonti consigliate
1. **Codici e nomi** — elenco ufficiale ISTAT dei comuni ("Elenco-comuni-italiani.csv", separatore `;`,
   aggiornato più volte l'anno per fusioni e nuove province; licenza CC BY). Scaricarlo dal sito ISTAT
   (sezione "Codici statistici delle unità amministrative territoriali").
2. **Coordinate** — da calcolare dai **confini amministrativi ufficiali ISTAT** (shapefile, licenza CC BY) con PostGIS:
   ```sql
   -- dopo aver importato lo shapefile dei comuni in una tabella `istat_comuni` (es. con shp2pgsql o ogr2ogr)
   COPY (
     SELECT pro_com_t AS codice,
            ST_Y(ST_Transform(ST_PointOnSurface(geom), 4326)) AS lat,
            ST_X(ST_Transform(ST_PointOnSurface(geom), 4326)) AS lon
     FROM istat_comuni
   ) TO STDOUT WITH CSV HEADER;
   ```
   `ST_PointOnSurface` garantisce un punto **dentro** il comune (a differenza del baricentro per i comuni a forma irregolare).

> ⚠️ **Attenzione (verificato il 26/09/2026):** il dataset comunitario `opendatasicilia/comuni-italiani`
> (`coordinate.csv`, riferito ai municipi) contiene errori di diversi km (es. Piacenza ~23 km, Bergamo ~9 km) e non
> dichiara una licenza. **Non usarlo** per la regola dei 50 km (ADR-0009).

### Passi
```bash
# 1. costruisce il CSV normalizzato (riporta i comuni senza coordinate e le coordinate inutilizzate)
pnpm geo:build --istat ./data/Elenco-comuni-italiani.csv --coords ./data/coordinate-istat.csv [--istat-encoding latin1]
# 2. importa nel DB (idempotente: si può rilanciare dopo ogni aggiornamento ISTAT)
DATABASE_URL=postgres://… pnpm geo:import ./data/municipalities.csv
```

## Mansioni (WP-006)
`data/occupations.csv` **è nel repository** (dato nostro, non di terzi). Non modificarlo a mano: si modifica
`scripts/data-src/occupations.py` e si rigenera con `python3 scripts/data-src/occupations.py`.
Il test `src/modules/taxonomy/domain/occupations-data.test.ts` controlla che nessun sinonimo sia conteso tra due mansioni
e che non ci siano termini discriminatori. I codici ISCO con `note` = "verificare codice ISCO" vanno confrontati con ESCO.

Caricamento nel DB (idempotente, si può rilanciare dopo ogni modifica del file):
`DATABASE_URL=postgres://… pnpm taxonomy:import`. Le mansioni tolte dal file non vengono cancellate dal DB
(offerte e profili le usano): lo script le elenca, si decide a mano.
