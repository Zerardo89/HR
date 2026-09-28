# Sprint 4 — Privacy, fiducia, soldi, qualità (lun 19/10 – dom 25/10)

> Obiettivo: *diritti degli utenti in self-service, segnalazioni DSA, pubblicità e pagamenti dietro flag, sicurezza e
> backup provati.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3 (settimana 4).
> "Mai tagliare" (06-ROADMAP): centro privacy/cancellazione (WP-023), backup (WP-027).

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 023 | ✅ Fatto (Claude, 28/09) | ✅ **023a** centro privacy `/account/privacy`: esporta i miei dati (JSON), consensi, cancellazione dell'account con crypto-shredding (ADR-0014). ✅ **023b** job di conservazione (inattività 6/23/24 mesi, log di sicurezza 12 mesi, lista d'attesa). |
| 024 | ✅ Fatto (Claude, 28/09) | ✅ **024a** segnalazioni (art. 16) e decisioni motivate (art. 17); un'azienda sospesa non legge più i dati dei candidati. ✅ **024b** condizioni d'uso versionate con regolamento annunci e moderazione (art. 14), nuova accettazione dopo un aggiornamento, punto di contatto (art. 11-12). Testi in **BOZZA**: revisione di Gemini e del professionista. |
| 025 | ⏳ Da fare | Pubblicità: slot, sponsor, CMP, AdSense (flag). |
| 026 | ⏳ Da fare | Stripe (flag) + webhook + portale. |
| 027 | 🟡 027a-c fatti (Claude, 28/09) | ✅ CSP con nonce e header di sicurezza; ✅ ruoli DB separati (`hr_app`, `hr_worker`), e2e in CI con i ruoli ristretti; ✅ backup, prova di ripristino e ripetizione delle cancellazioni (ADR-0014), runbook. ⏳ sul server (WP-010): cron dei backup, restic, Caddy con HSTS e limite di frequenza generale. |
| 028 | ⏳ Da fare | E2E dei percorsi critici, accessibilità, carico. |

---

## WP-023a — Centro privacy ✅
**Esecutore:** Claude (modulo privacy, cifratura) · **Codice:** `src/modules/privacy/{domain,server/erasure.ts,
server/export.ts,server/consents.ts,server/actions.ts,jobs.ts}`, pagina `/account/privacy`, route
`/api/privacy/export`, pagina `/account-cancellato`, link da `/account`, ADR-0014

- **Esporta i miei dati** (R-PRIV-04, art. 15 e 20 GDPR): un file JSON con chiavi in italiano — account (email),
  consensi, profilo con i dati identificativi decifrati, mansioni e lingue, candidature con messaggio, avvisi,
  aziende di cui fa parte, e **chi ha letto i suoi dati cifrati** per categoria e scopo ("tu", "azienda a cui ti sei
  candidata/o", "sistema"): mai l'identità di altre persone. Ogni decifratura con scopo `privacy.export`. Solo con
  l'accesso (e il secondo passaggio se attivo); mai in cache. Il PDF arriva con il CV (WP-018).
- **Cancella l'account**, subito e da sola/o (anche requisito Google Play): si scrive "CANCELLA" per confermare.
  In una transazione: DEK distrutta (crypto-shredding), profilo, candidature, avvisi, sessioni, codici di recupero,
  token e appartenenze alle aziende cancellati; indice cieco dell'email liberato (ci si può registrare di nuovo);
  resta una lapide senza dati personali, i consensi come prova e l'audit `account.delete`. Unico titolare di
  un'azienda con colleghi → la titolarità passa al collega attivo più anziano (audit `company.owner_transfer`).
- **Backup — correzione di una promessa** (ADR-0014): la DEK è nel DB cifrata con la KEK, quindi i backup fatti prima
  della cancellazione la contengono ancora. Testo corretto ovunque (docs/04, ADR-0004, pagina): i dati diventano
  subito illeggibili nel sistema e nelle copie di sicurezza cifrate spariscono con la rotazione, al più entro 6 mesi.
  Ogni cancellazione scrive `account.erased` (solo l'id) nel log applicativo, per ripeterla dopo un ripristino.
- **API `privacy/jobs.ts`**: i servizi del modulo privacy senza Next.js; gli altri moduli la usano (così il worker
  non carica le Server Actions del centro privacy).
- Test: 1 unitario (parola di conferma), 3 di integrazione (esportazione completa senza dati di altri, cancellazione
  con tutto ciò che deve sparire e restare, email riutilizzabile, passaggio di titolarità), 1 e2e × 2 dispositivi
  (esporta dal sito, 401 senza accesso, parola sbagliata, cancellazione, sessione non più valida, nuova
  registrazione con la stessa email senza il vecchio profilo).
- Da fare: pagina pubblica "come cancellare l'account" per la scheda Play (WP-010).

## WP-023b — Job di conservazione ✅
**Esecutore:** Claude (tocca `audit_log` e la cancellazione) · **Codice:** `src/modules/privacy/{domain/retention.ts,
server/retention.ts,jobs.ts}`, `src/modules/identity/server/activity.ts`, job del worker, migrazioni 0012 e 0013

Regola R-PRIV-03, tabella in docs/04 §8. Tre job giornalieri, a lotti di 500 e ripetibili:
- **`retention.accounts` (04:15)**, in ordine:
  1. *6 mesi* senza accesso né interazione col profilo → profilo nascosto, mail mensile spenta, un avviso.
  2. *23 mesi* senza accesso → preavviso con la **data** di cancellazione: 30 giorni dopo, ma mai prima dei 24 mesi
     (a cavallo dei mesi di 31 giorni la data slitta di un giorno). Chi entra anche una volta perde il preavviso.
  3. *Dal giorno annunciato* (ora italiana, così il job che gira qualche secondo prima non rimanda di un giorno) →
     la stessa cancellazione con crypto-shredding del centro privacy, attore `system:retention`. Personale escluso.
- **`retention.audit` (04:30)**: righe del log di sicurezza oltre 12 mesi. Il trigger (migrazione 0013) ammette
  solo questa cancellazione; modifiche e cancellazioni delle righe recenti restano vietate. Il job usa anche la
  soglia dell'orologio del DB, così uno scarto di qualche secondo col worker non fa fallire il lotto.
- **`retention.waitlist` (04:40)**: chi si è registrato esce subito dalla lista d'attesa (confronto per indice cieco,
  senza decifrare); dal 01/05/2027 (6 mesi dal lancio) esce chiunque.
- **Attività = accesso o clic** (R-PRIV-03): rispondere alla mail mensile (o disiscriversi) aggiorna
  `users.last_active_at` (`recordActivity`, API `identity/jobs.ts`), così chi risponde senza mai entrare non riceve
  il preavviso di cancellazione.
- Ruoli DB separati (il DELETE su `audit_log` al solo worker): WP-027.
- Test: 8 unitari (soglie, date annunciate, mesi a cavallo del 31, lista d'attesa), 5 di integrazione
  (nascondi una volta sola, preavviso e ritorno, cancellazione solo dopo il preavviso e mai per il personale, log
  oltre 12 mesi cancellato e recente immodificabile, lista d'attesa) + 1 nella mail mensile (la risposta è attività).

## WP-024a — Segnalazioni e decisioni motivate (DSA art. 16-17) ✅
**Esecutore:** Claude (tocca l'accesso ai dati dei candidati) · **Regole:** R-DSA-03, R-DSA-04, R-ANN-08, R-PRIV-02 ·
**Codice:** `src/modules/trust/**`, pagina `/segnalazioni`, sezione in `/moderazione`

**Segnalare** (art. 16). Da ogni offerta pubblicata, link "Segnala" → `/segnalazioni?offerta=<id>`:
- si sceglie cosa segnalare (l'annuncio o l'azienda che lo pubblica), il motivo (truffa, discriminazione, richiesta
  di soldi, informazioni false, lavoro illegale, altro) e una descrizione facoltativa (max 1000 caratteri; **senza
  email né numeri di telefono**, R-PRIV-02: il moderatore vede già l'annuncio). Obbligatoria la dichiarazione di
  buona fede (art. 16.2.d).
- Anche **senza account**. Con l'account: ricevuta subito (art. 16.4) ed esito dopo la decisione (art. 16.5), all'email
  dell'account. Senza account nessuna email (non chiediamo indirizzi a chi non è registrato).
- Limiti: 5 segnalazioni ogni 15 minuti per IP (in memoria), una sola segnalazione aperta per utente e bersaglio;
  si segnala solo ciò che è pubblico (offerta pubblicata di azienda verificata).

**Decidere** (moderatori e admin, con 2FA; controllo del ruolo anche nel servizio). In `/moderazione`, coda per
bersaglio dalla segnalazione più vecchia: annuncio, azienda, motivi con conteggio, descrizioni.
- Annuncio → **rimuovi** o **archivia**; azienda → **sospendi** o **archivia**. Rimuovere e sospendere richiedono il
  **fondamento** (da un elenco: legge o Regolamento annunci) e i **fatti** (20-1000 caratteri, senza email né
  telefoni). Tutte le segnalazioni aperte sul bersaglio si chiudono insieme; una seconda decisione non trova nulla.
- Rimozione: offerta `removed`, sparisce ovunque, le candidature aperte si chiudono e i candidati ricevono l'email
  "offerta tolta" con l'avviso di non dare soldi o documenti. Sospensione: azienda `suspended`, le sue offerte
  pubblicate o in moderazione diventano `removed` (stesse email ai candidati) e **i suoi membri non leggono più i
  dati dei candidati** (controllo in `modules/privacy`).
- **Motivazione** (art. 17), salvata in `reports.statement_of_reasons` e spedita a tutti i membri attivi
  dell'azienda: decisione e portata, fatti, fondamento, uso di mezzi automatici (nessuno: decide una persona, a
  partire da una segnalazione), rimedi (riesame entro 6 mesi dal punto di contatto; giudice ordinario).
- Audit `report.decide`: attore il moderatore, bersaglio offerta o azienda, scopo la decisione.

**Test di accettazione** (scritti prima): dominio (input della segnalazione e della decisione, rilevatore di
contatti, testo della motivazione con tutti gli elementi dell'art. 17), integrazione (anonima e con account,
bersaglio non pubblico, doppione, rimozione con candidature chiuse ed email, archiviazione, sospensione con
accesso ai dati dei candidati negato, solo moderatori), e2e (segnala senza account → il moderatore rimuove →
l'offerta non c'è più → l'azienda riceve la motivazione).

**Fatto (28/09).** Come da specifica, più:
- **Buco chiuso in `modules/privacy`**: prima un'azienda sospesa poteva ancora aprire le candidature e leggere i
  dati dei candidati. Ora `companyRecipient` (e le notifiche di nuove candidature, e l'elenco della casella)
  richiedono un'azienda verificata. Il test di integrazione della sospensione fallisce senza questa correzione.
- Email "offerta tolta" ai candidati (motivo `removed` di "posizione chiusa") con la messa in guardia su soldi,
  dati bancari e documenti.
- Il modulo di segnalazione si ricrea a ogni errore con i valori scritti (prima il motivo scelto si perdeva: una
  `select` non torna al valore precedente dopo il reset del form di React). Stessa correzione nel modulo della
  lista d'attesa (WP-009), dove si perdeva la provincia: nuovo e2e che fallisce col codice vecchio.
- `/segnalazioni` non è più una pagina "bozza": il test e2e delle pagine legali (WP-009) non la elenca più.
- **E2e più robusti su DB nuovo** (come in CI): avvisi, centro privacy e mail mensile cercavano o scrivevano
  "Lodi" prima di inserirlo nel DB; funzionavano solo se un altro test l'aveva già messo. Ora `seedLodi()` in
  `tests/e2e/helpers.ts`, chiamato all'inizio.
- Test: 10 unitari, 5 di integrazione, 1 e2e × 2 dispositivi.

## WP-024b — Condizioni d'uso versionate e punto di contatto (DSA art. 11-14) ✅
**Esecutore:** Claude (codice e bozza dei testi; da rivedere con Gemini e il professionista) · **Regole:** R-DSA-01,
R-DSA-02 · **Codice:** `content/legal/condizioni.ts`, `src/lib/markdown-lite.ts`, `src/modules/trust/{domain/terms.ts,
server/terms.ts,ui/terms-banner.tsx}`, pagine `/condizioni` e `/contatti`, `src/app/_components/legal-document.tsx`

- **Testi versionati** in `content/legal/condizioni.ts`: ogni versione pubblicata resta nel file, identica. Un test
  confronta l'impronta (SHA-256) di ogni versione: per cambiare il testo si **aggiunge** una versione (e la sua
  impronta nel test) e si aggiorna `LEGAL_VERSIONS.terms`. Formato Markdown ridotto (titoli con ancora, paragrafi,
  elenchi, grassetto, link interni), reso con componenti React: nessun HTML dal testo. Moduli TS e non file letti a
  runtime: con l'immagine `standalone` finiscono sempre nel bundle.
- **Bozza "bozza-2026-09-28"** (sostituisce il segnaposto "bozza-2026-09-27", che resta consultabile): chi siamo,
  chi può usare il servizio, costi, **regolamento degli annunci** (`#regolamento-annunci`, citato nelle motivazioni
  delle decisioni), **come controlliamo gli annunci** (art. 14: controllo automatico a regole senza IA, controllo
  umano, segnalazioni, decisioni motivate, riesame, ordine dei risultati), obblighi, dati personali (rimando
  all'informativa, nessun claim), sospensione, modifiche, contatti e legge applicabile.
- **`/condizioni`**: versione in vigore con data, archivio di tutte le versioni (`?versione=`, non indicizzate).
- **Nuova accettazione** (art. 14.2): chi ha accettato una versione precedente vede in ogni pagina l'avviso
  «Abbiamo aggiornato le condizioni d'uso» con il link e il pulsante «Accetto»; l'accettazione è una nuova riga in
  `consents`, così resta la prova di entrambe le versioni. Non blocca la navigazione.
- **`/contatti`**: punto di contatto unico per utenti e autorità (art. 11-12): email e PEC da `lib/organization`
  (oggi "in costituzione"), lingue italiano e inglese, risponde una persona, come segnalare, riesame entro 6 mesi,
  dati personali in autonomia da «Privacy e dati».
- La motivazione delle decisioni (024a) ora include il link al regolamento degli annunci.
- Test: 4 unitari (versioni immutabili, sezioni DSA, archivio, nuova accettazione) + 3 del Markdown ridotto,
  2 di integrazione (nuova accettazione una sola volta, prova delle due versioni), 3 e2e × 2 dispositivi.
- Da fare: revisione dei testi (Gemini, poi il professionista); informativa privacy versionata allo stesso modo.

## WP-027 — Sicurezza, ruoli del database, backup e ripristino (027a-c) ✅
**Esecutore:** Claude (proxy, ruoli, privacy) · **Codice:** `src/lib/security-headers.ts`, `src/proxy.ts`,
`next.config.ts`, `src/lib/db/roles.ts`, `scripts/db-roles.ts`, `src/modules/privacy/{domain/erasure-log.ts,
server/ledger.ts,server/erasure.ts}`, `scripts/reapply-erasures.ts`, `scripts/ops/{backup,restore-test}.sh`,
[runbook](../runbook/BACKUP-E-RIPRISTINO.md)

- **027a — Header e CSP.** CSP con nonce nuovo a ogni pagina e `strict-dynamic` (guida Next.js 16): niente script
  inline senza nonce, niente origini esterne, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`;
  `upgrade-insecure-requests` solo in HTTPS. Su tutte le risposte (API comprese): `nosniff`, `X-Frame-Options`,
  `Referrer-Policy: same-origin` (i link con token delle email non escono verso altri siti; non `no-referrer`, che
  toglierebbe l'`Origin` ai POST usato da Next.js contro il CSRF), `Permissions-Policy`, COOP; HSTS in HTTPS.
  Pubblicità (WP-025) e statistiche dovranno aggiungere le loro origini alla CSP, dietro i flag.
- **027b — Ruoli separati.** `pnpm db:roles` (idempotente, dopo ogni migrazione): `hr_app` per il sito (niente DDL,
  log di audit solo in aggiunta), `hr_worker` per i job (+ cancellazione del log oltre 12 mesi, schema `pgboss`,
  permesso di creare schemi che pg-boss richiede). **Trovato e risolto**: con i ruoli ristretti il worker non partiva
  (pg-boss esegue `CREATE SCHEMA IF NOT EXISTS`, che chiede il permesso anche se lo schema c'è). La CI ora fa girare
  **tutti gli e2e** col sito come `hr_app` e i job come `hr_worker`.
- **027c — Backup e ripristino (ADR-0014).** Registro delle cancellazioni fuori dal DB (`ERASURE_LEDGER_FILE`, una
  riga JSON con il solo id, permessi 600); se non si scrive, la cancellazione vale lo stesso e il log segnala
  l'errore. `pnpm privacy:reapply-erasures` ripete le cancellazioni dopo un ripristino (attore `system:restore`).
  `scripts/ops/backup.sh` (pg_dump + restic, 7/4/6) e `scripts/ops/restore-test.sh` (DB di prova, conteggi, ripetizione
  delle cancellazioni, pulizia): prova fatta su un dump reale del DB di test, riuscita.
- **Limiti di frequenza**: rivisti. Ci sono dove servono (codici di accesso per IP, lista d'attesa e segnalazioni per
  IP, inviti per azienda, una candidatura per offerta); il limite generale va su Caddy con il server (WP-010).
- Test: 4 + 2 unitari (header, registro), 4 di integrazione sui ruoli + 3 sul ripristino, 4 e2e × 2 dispositivi
  (header, nonce diverso per richiesta, nessuna violazione CSP, componenti interattivi funzionanti). Verificato che
  gli e2e falliscono se la CSP blocca gli script.
- Da fare sul server (WP-010): cron dei backup alle 01:30 e del registro ogni ora, repository restic fuori sede,
  prima prova di ripristino in produzione, Caddy (HSTS, limite generale).
