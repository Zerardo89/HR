# Sprint 4 — Privacy, fiducia, soldi, qualità (lun 19/10 – dom 25/10)

> Obiettivo: *diritti degli utenti in self-service, segnalazioni DSA, pubblicità e pagamenti dietro flag, sicurezza e
> backup provati.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3 (settimana 4).
> "Mai tagliare" (06-ROADMAP): centro privacy/cancellazione (WP-023), backup (WP-027).

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 023 | 🟡 023a fatto (Claude, 28/09) | ✅ **023a** centro privacy `/account/privacy`: esporta i miei dati (JSON), consensi, cancellazione dell'account con crypto-shredding (ADR-0014). ⏳ **023b** job di conservazione (inattività 6/23/24 mesi, log di sicurezza 12 mesi, lista d'attesa). |
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
- Da fare: 023b (job di conservazione); pagina pubblica "come cancellare l'account" per la scheda Play (WP-010).
