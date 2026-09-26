# Sprint 1 — Work package dettagliati (mar 29/09 – dom 04/10)

> Ogni WP qui sotto viene copiato in un file `docs/work-packages/WP-xxx.md` il giorno in cui parte, con eventuali
> aggiustamenti di Claude. Prompt da usare: [../prompts/ollama-work-package.md](../prompts/ollama-work-package.md).
> **Obiettivo dello sprint:** fondamenta solide + **app Android in test chiuso entro venerdì 02/10** (gate G1).

---

## WP-001 — Scaffold del progetto
**Esecutore:** Ollama · **Revisione:** ChatGPT → Claude · **Stima:** 3-4 h · **Giorno:** mar 29/09

**Obiettivo:** progetto Next.js vuoto ma con tutta la "catena di qualità" funzionante.

**Da fare**
- `pnpm create next-app` con App Router, TypeScript, ESLint, Tailwind v4, `src/`, alias `@/*`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- shadcn/ui inizializzato (solo `button`, `input`, `label`, `card` per ora).
- ESLint + `eslint-plugin-boundaries` configurato sui moduli `src/modules/*` (un modulo importa gli altri solo da `index.ts`).
- Prettier.
- Vitest (unità) + Playwright (e2e) con un test d'esempio ciascuno.
- Script in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, **`check`** (= lint + typecheck + test).
- `next-intl` con `messages/it.json` e una sola lingua.
- `VERSIONS.md` con le versioni esatte installate (Node, pnpm, next, react, typescript, tailwind, drizzle…).
- Struttura cartelle vuota come in [03-ARCHITETTURA.md §4](../03-ARCHITETTURA.md) (con `.gitkeep`).
- `.gitignore` (include `.env*` tranne `.env.example`), `.nvmrc` (24), `.editorconfig`.

**Dipendenze ammesse:** next, react, react-dom, typescript, tailwindcss, @tailwindcss/postcss, eslint, eslint-config-next, eslint-plugin-boundaries, prettier, vitest, @vitejs/plugin-react, @playwright/test, next-intl, zod, dipendenze di shadcn/ui (class-variance-authority, clsx, tailwind-merge, lucide-react, radix).

**Criteri di accettazione**
- [ ] `pnpm check` verde; `pnpm build` verde; `pnpm test:e2e` apre la home e trova il titolo.
- [ ] Un import "vietato" tra moduli (es. `src/modules/offers/server/x` da `src/modules/profiles`) fa fallire il lint (test manuale documentato nella PR).
- [ ] Nessuna stringa italiana cablata nei componenti: la home legge da `messages/it.json`.

---

## WP-002 — Ambiente di sviluppo, configurazione, logger, flag
**Esecutore:** Ollama · **Revisione:** ChatGPT → Claude · **Stima:** 3 h · **Giorno:** mar 29/09

**Da fare**
- `docker-compose.dev.yml`: `postgis/postgis:17-3.5` (volume, porta **solo** su `127.0.0.1`), `axllent/mailpit` (SMTP 1025, UI 8025).
- `src/lib/env.ts`: validazione con Zod di tutte le variabili; l'app **non parte** se manca qualcosa. `.env.example` completo e commentato.
- `src/lib/logger.ts`: pino, JSON, `redact` per `email`, `phone`, `firstName`, `lastName`, `name`, `*.email`, `*.phone`, `authorization`, `cookie`, `password`, `token`, `otp`.
- `src/lib/flags.ts`: `INTERMEDIATION_ENABLED`, `BILLING_ENABLED`, `ADSENSE_ENABLED`, `PREVIEW_MODE` (boolean, default false), `FOUNDERS_PERIOD_UNTIL` (data ISO).
- `GET /api/health` → `{ status: "ok", db: "ok" | "down", version }` (senza dettagli interni).

**Test:** env valida/non valida; logger che **non** stampa un'email passata in un oggetto; flag con default.

**Criteri di accettazione**
- [ ] `docker compose -f docker-compose.dev.yml up -d` + `pnpm dev` → `/api/health` risponde ok.
- [ ] Test di redazione del logger verde.

---

## WP-003 — Integrazione continua (GitHub Actions)
**Esecutore:** Ollama · **Revisione:** Claude · **Stima:** 2 h · **Giorno:** mer 30/09

**Da fare** — `.github/workflows/ci.yml` su `pull_request` e `push` a `main`:
1. checkout, setup pnpm + Node 24 (cache), `pnpm install --frozen-lockfile`
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`
3. `pnpm build`
4. **gitleaks** (segreti), `pnpm audit --prod --audit-level=high`
5. **Semgrep** con regole `p/owasp-top-ten` e `p/typescript`
6. Playwright smoke sulla build (servizio Postgres nel job)

**Criteri di accettazione:** CI verde su una PR di prova; una PR con un finto segreto (`AKIA…`) fallisce.

---

## WP-004 — Schema del database v1 e migrazioni
**Esecutore:** Claude (scheletro e tabelle sensibili) + Ollama (tabelle di riferimento) · **Revisione:** Claude · **Stima:** 4 h · **Giorno:** mer 30/09

**Da fare**
- Drizzle + drizzle-kit, connessione in `src/lib/db/index.ts` (pool `pg`).
- Schema in `src/lib/db/schema/` secondo [03-ARCHITETTURA.md §5](../03-ARCHITETTURA.md): `municipalities`, `provinces`, `regions`, `occupations`, `skills`, `users`, `worker_profiles`, `profile_occupations`, `companies`, `company_sites`, `company_members`, `job_offers`, `applications`, `saved_searches`, `consents`, `email_action_tokens`, `entitlements`, `reports`, `audit_log`, `ad_placements`, `regional_internship_minimums`, `waitlist`.
- Estensioni: `postgis`, `pg_trgm`, `unaccent` (prima migrazione).
- `audit_log`: trigger che impedisce UPDATE/DELETE; ruolo applicativo con soli INSERT/SELECT su quella tabella.
- Colonne C2 **solo** come `bytea`/testo cifrato (`*_enc`) + `dek_wrapped` + `key_version`: nessuna colonna `email`, `first_name`, `phone` in chiaro.
- Enum Postgres per stati (`worker_state`, `offer_status`, `application_status`, `contract_type`…).
- Indici: GiST sui centroidi, GIN su `search_tsv` e trigrammi dei titoli, indici su chiavi esterne e stati.

**Test:** migrazione su DB vuoto; test "nessuna colonna vietata" (query su `information_schema.columns`: fallisce se trova nomi come `email`, `phone`, `first_name`, `last_name`, `birth_date`, `gender`, `nationality`, `photo`); UPDATE su `audit_log` → errore.

---

## WP-005 — Comuni ISTAT, geografia e zona gratuita
**Esecutore:** Ollama (test scritti da Claude) · **Revisione:** Claude · **Stima:** 4 h · **Giorno:** gio 01/10

**Da fare**
- `scripts/import-municipalities.ts`: importa regioni, province e comuni (codici ISTAT) + centroidi da un CSV aperto versionato in `data/` (fonte e licenza in `data/README.md`). **Idempotente** (upsert).
- `src/modules/geo/`: `distanceKm(a, b)` (dominio, haversine per i test) e query PostGIS `municipalitiesWithin(code, km)`.
- `src/modules/matching/domain/freeZone.ts`:
  ```ts
  type Site = { municipalityCode: string; regionCode: string; approved: boolean; lat: number; lon: number };
  type Place = { municipalityCode: string; regionCode: string; lat: number; lon: number };
  export function isInFreeZone(sites: Site[], place: Place, radiusKm = 50): boolean;
  ```
- Query server equivalente con `ST_DWithin` (deve dare lo stesso risultato della funzione di dominio sui casi di test).

**Test (scritti da Claude, non modificabili):**
- stesso comune → true · stessa regione a 200 km → true · regione diversa a 30 km → true · regione diversa a 50,1 km → false · 49,9 km → true · sede non approvata → ignorata · più sedi, una sola valida → true · nessuna sede → false.

---

## WP-006 — Tassonomia delle mansioni
**Esecutore:** Ollama + Gemini (dati G-05) · **Revisione:** Claude · **Stima:** 3 h · **Giorno:** sab 03/10

**Da fare**
- `data/occupations.csv` (Gemini + verifica umana): ~300 mansioni frequenti con `label_it`, `synonyms` (separati da `|`), `isco_code`, `esco_uri` (se disponibile), `group_code`.
- `scripts/import-occupations.ts` idempotente.
- `searchOccupations(q)`: prima corrispondenza su sinonimi normalizzati (minuscole, senza accenti), poi similarità trigrammi; massimo 10 risultati.
- Endpoint/Server Action per l'autocompletamento + componente `OccupationPicker` accessibile (combobox).

**Criteri di accettazione:** "lavapiatti", "lava piatti", "aiuto cucina" trovano la stessa mansione; "magazinier" (refuso) trova "Magazziniere"; tempo di risposta < 50 ms in locale.

---

## WP-007 — Modulo crittografico
**Esecutore:** **Claude** · **Seconda lettura:** ChatGPT · **Stima:** 4 h · **Giorno:** gio 01/10

Specifica in [ADR-0004](../adr/ADR-0004-cifratura-applicativa.md). `src/lib/crypto/`:
- `KeyProvider` + `FileKeyProvider` (KEK da file indicato in env, 32 byte base64; chiave indice cieco separata).
- `generateDek()`, `encryptJson(dek, obj, aad)`, `decryptJson(dek, blob, aad)` (AES-256-GCM, formato `v1.<iv>.<tag>.<ciphertext>` in base64url).
- `blindIndex(value, purpose)` con normalizzazione (email: trim + minuscole).
- `decryptPii()` di alto livello che registra in `audit_log`.
- Script `scripts/generate-keys.ts` per creare KEK e chiave indice (stampa istruzioni per il custode).

**Test:** round-trip · tag manomesso → errore · AAD diverso → errore · DEK sbagliata → errore · stesso input → IV diversi · indice cieco deterministico e diverso per `purpose` diversi.

---

## WP-008 — Autenticazione
**Esecutore:** Claude (adattatore email cifrata, policy) + Ollama (UI) · **Revisione:** Claude · **Stima:** 6 h · **Giorno:** dom 04/10

**Da fare**
- Better Auth con plugin OTP via email (6 cifre, 10 minuti, max 5 tentativi), sessioni su DB, ruoli (`worker`, `company_member`, `moderator`, `admin`).
- Adattatore: l'email si salva come `email_bidx` + `email_enc`; la ricerca per login usa l'indice cieco.
- Pagine: `/accedi` (email → codice), `/registrati/lavoratore`, `/registrati/azienda` (solo account; l'azienda si completa nel WP-011).
- Checkbox obbligatoria "Ho almeno 18 anni" (R-LAV-09) e presa visione informativa (versione salvata in `consents`).
- Invio email via Nodemailer → Mailpit in dev.
- Rate limit su richiesta codice (per IP e per email).

**Criteri di accettazione:** e2e registrazione + login con codice letto da Mailpit; nessuna email in chiaro nel DB (test WP-004 ancora verde); 6° tentativo bloccato.

---

## WP-009 — Layout, landing e lista d'attesa
**Esecutore:** Ollama + Gemini (testi) + ComfyUI (grafica) · **Revisione:** Claude · **Stima:** 5 h · **Giorno:** ven 02/10

**Da fare**
- Layout pubblico: intestazione, piè di pagina con **dati dell'ente e legale rappresentante** (segnaposto finché l'associazione non esiste — R-LAV-04, R-CONS-04), link a privacy/cookie/T&C/contatti/segnalazioni.
- Landing: cosa è, per chi, "gratis per chi cerca lavoro", "gratis per le aziende della tua zona", modulo **lista d'attesa**: email + tipo (lavoratore/azienda) + provincia, consenso esplicito all'avviso di lancio; **double opt-in** (email di conferma con link → pagina di conferma con pulsante).
- Tabella `waitlist` con email **cifrata** + indice cieco (stesse regole del resto).
- Pagine legali con testi BOZZA di Gemini (G-03).
- Nessun cookie non tecnico; Umami non ancora.

**Criteri di accettazione:** Lighthouse mobile ≥ 90 (prestazioni, accessibilità, best practice, SEO); iscrizione e conferma funzionanti via Mailpit.

---

## WP-010 — PWA, TWA e staging
**Esecutore:** Tu + Claude · **Stima:** 5 h · **Giorno:** ven 02/10 · **Gate G1**

**Da fare**
- `src/app/manifest.ts`: nome, nome breve, colori, `display: standalone`, icone 192/512 + maskable (V-02), `start_url`, `scope`, `lang: it`.
- Service worker minimo (shell offline con pagina "Sei offline").
- Deploy su VPS: Docker Compose con Caddy sul **dominio di produzione** in modalità anteprima (vedi decisione in fondo), HTTPS automatico.
- **Bubblewrap:** `bubblewrap init --manifest https://lavoro.<dominio>/manifest.webmanifest`, nome pacchetto definitivo (Q2), target API 36, firma con **Play App Signing** (conserva la chiave di upload in un posto sicuro + copia dal custode).
- `/.well-known/assetlinks.json` con l'impronta SHA-256 della chiave di firma di Play.
- Play Console: scheda base (testi G-04, grafica V-02/V-03), informativa privacy (URL), classificazione dei contenuti, pubblico 18+, "contiene annunci: sì" (se previsti), Data safety (bozza), **test interno** → poi **test chiuso** con il Google Group dei tester.

**Criteri di accettazione:** l'app installata dal test chiuso si apre **senza barra degli indirizzi**; ≥ 12 tester hanno accettato l'invito e installato l'app.

> **Decisione dell'architetto: la TWA punta fin da subito al dominio di produzione (`lavoro.`), non a `beta.`.**
> Cambiare dominio dopo vorrebbe dire aggiornare l'app (nuovo URL + assetlinks) proprio nei giorni del lancio.
> Fino al 27/10 il dominio di produzione gira in **modalità anteprima** (flag `PREVIEW_MODE=true`):
> - banner fisso "Anteprima con dati di prova", `noindex` e `robots.txt` che blocca tutto;
> - dati sintetici (seed G-19); registrazione possibile solo con **codice invito** (i tester), con informativa dedicata che dice che i dati verranno cancellati;
> - la **lista d'attesa** invece è reale (email cifrate) e sopravvive al passaggio.
> Il 27/10 si azzera il DB **tranne la tabella `waitlist`**, si imposta `PREVIEW_MODE=false` e si inseriscono le aziende reali.
> Dopo il lancio `beta.` diventa lo staging vero e proprio.
> Quindi in questo WP il deploy va su `lavoro.` in modalità anteprima (niente basic auth: servono `assetlinks.json` e l'accesso dei tester).
