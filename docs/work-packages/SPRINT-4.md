# Sprint 4 — Privacy, fiducia, soldi, qualità (lun 19/10 – dom 25/10)

> Obiettivo: *diritti degli utenti in self-service, segnalazioni DSA, pubblicità e pagamenti dietro flag, sicurezza e
> backup provati.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3 (settimana 4).
> "Mai tagliare" (06-ROADMAP): centro privacy/cancellazione (WP-023), backup (WP-027).

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 023 | ✅ Fatto (Claude, 28/09) | ✅ **023a** centro privacy `/account/privacy`: esporta i miei dati (JSON), consensi, cancellazione dell'account con crypto-shredding (ADR-0014). ✅ **023b** job di conservazione (inattività 6/23/24 mesi, log di sicurezza 12 mesi, lista d'attesa). |
| 024 | ⏳ Da fare | Segnalazioni DSA + decisioni motivate + T&C versionati. |
| 025 | ⏳ Da fare | Pubblicità: slot, sponsor, CMP, AdSense (flag). |
| 026 | ⏳ Da fare | Stripe (flag) + webhook + portale. |
| 027 | ⏳ Da fare | Hardening: CSP, header, rate limit, backup + prova di ripristino (anche: ripetere le cancellazioni dopo il ripristino, ADR-0014). |
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
