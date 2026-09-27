# Versioni bloccate (aggiornato il 27/09/2026 — WP-008)

Le versioni sono fissate in `package.json` + `pnpm-lock.yaml`. **Non aggiornarle dentro un WP qualsiasi**:
gli aggiornamenti si fanno in WP dedicati, con `pnpm check`, test di integrazione ed e2e verdi.

## Piattaforma
| Componente | Versione | Note |
|------------|----------|------|
| Node.js | 24 LTS (`.nvmrc`) — minimo 22.12 | CI su Node 24 |
| pnpm | 10.33.0 (`packageManager`) | |
| PostgreSQL + PostGIS | 17 + 3.5 (`postgis/postgis:17-3.5`) | in locale va bene anche 16 + 3.4 |
| Mailpit | v1.31 | solo sviluppo |

## Dipendenze principali
| Pacchetto | Versione | Differenze da ricordare (per i modelli locali) |
|-----------|----------|-----------------------------------------------|
| next | 16.3.6 | `params`, `searchParams`, `cookies()`, `headers()` sono **asincroni**; l'intercettazione delle richieste è in `proxy.ts` (non `middleware.ts`); i tipi `PageProps`/`LayoutProps` sono globali generati da `next typegen`. **Documentazione della versione installata: `node_modules/next/dist/docs/`** — leggila prima di scrivere codice Next. |
| react / react-dom | 19.3.0 | Server Components di default; `"use client"` solo se servono stato/eventi |
| typescript | 5.9.3 | **Non** passare a TS 6/7: typescript-eslint supporta TS < 6.1 |
| tailwindcss | 4.3.3 | configurazione in CSS (`@theme` in `src/app/globals.css`), niente `tailwind.config.js` |
| next-intl | 4.14.7 | una sola lingua (`it`), senza routing per lingua; `getTranslations()` lato server |
| zod | 4.6.5 | API v4: `z.url()`, `z.email()` sono funzioni di primo livello |
| drizzle-orm / drizzle-kit | 0.45.3 / 0.31.11 | schema in `src/lib/db/schema/`; migrazioni in `db/migrations/` (vedi sotto) |
| pg | 8.23.0 | |
| pino | 10.3.1 | usa sempre `src/lib/logger.ts` (redazione dei dati personali) |
| qrcode | 1.5.4 | QR code della 2FA (`src/modules/identity/server/enrollment.ts`), generato sul server |
| nodemailer | 10.0.10 | solo tramite `src/lib/mail` (`getMailer()`); tipi inclusi nel pacchetto |
| eslint | 9.39.5 | configurazione flat `eslint.config.mjs`; confini tra moduli con `import/no-restricted-paths` |
| vitest | 5.0.2 (+ vite 8.3.1) | unitari: `pnpm test`; integrazione: `pnpm test:integration` |
| @playwright/test | 1.63.0 | progetti `mobile` (Pixel 5) e `desktop` |
| prettier | 3.9.9 | `pnpm format` |

## Migrazioni del database
- `0000_extensions.sql` — **scritta a mano**: PostGIS, pg_trgm, unaccent, configurazione di ricerca `italian_unaccent`.
- `0001_schema_v1.sql` — generata da drizzle-kit dallo schema.
- `0002_audit_append_only.sql` — **scritta a mano**: trigger che rendono `audit_log` immodificabile.
- `0003_auth.sql` — generata: tabelle dell'accesso (codici, sessioni, biglietti di registrazione) — WP-008.
- `0004_occupations_slug.sql` — generata: `slug` e `category` delle mansioni (import idempotente) — WP-006.
- `0005_company_verification.sql` — generata: `companies.verification` (esito VIES, nessun dato personale) — WP-011.
- `0006_mfa.sql` — generata: 2FA (segreto TOTP cifrato con la KEK, ultimo periodo usato, sessioni verificate, codici di recupero come MAC) — WP-011b.
- Nuove modifiche: cambia lo schema → `pnpm db:generate` → rivedi l'SQL → committa. La CI fallisce se lo schema cambia senza migrazione.
- Le migrazioni che toccano colonne cifrate o `audit_log` le scrive/valida l'architetto (CLAUDE.md).
