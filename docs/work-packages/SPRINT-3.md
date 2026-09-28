# Sprint 3 — Lavoratori e candidature (lun 12/10 – dom 18/10)

> Obiettivo (traguardo M3): *tutto il percorso lavoratore funziona in staging: registrazione → profilo → ricerca →
> candidatura → risposta dell'azienda → avviso → mail mensile.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 017 | ✅ Fatto (Claude, 28/09) | Profilo del lavoratore `/profilo`: dati di ricerca in chiaro, dati identificativi **cifrati** dal modulo `privacy` con audit di ogni lettura; stati cerco / aperto / nascosto; "disponibile a trasferirmi in…". |
| 018 | ⏳ Da fare | CV in PDF generato dal profilo (senza foto). |
| 019 | ✅ Fatto (Claude, 28/09) | Candidatura dalla pagina dell'offerta, "le mie candidature" con stato e ritiro, casella dell'azienda: dati identificativi decifrati **solo** per l'azienda destinataria, con audit; email all'azienda senza dati del candidato. |
| 020 | ⏳ Da fare | Avvisi (ricerche salvate) + worker pg-boss. |
| 021 | ⏳ Da fare | Mail ogni 30 giorni per gli "aperti" + token + pagine di conferma + RFC 8058. |
| 022 | ⏳ Da fare | Scadenza e chiusura delle offerte + notifica ai candidati. |

---

## WP-017 — Profilo del lavoratore ✅
**Esecutore:** Claude (parte PII) · **Codice:** `src/modules/profiles/**`, `src/modules/privacy/server/{audit,worker-pii}.ts`,
pagina `/profilo`, link da `/account`

- **Dati C1 (in chiaro, servono alla ricerca e agli avvisi)**: fino a 5 mansioni (dalla tassonomia), comune (con
  "forse cercavi" e omonimi con la provincia), distanza massima, regioni dove trasferirsi, fascia di esperienza,
  contratti e orari preferiti, disponibile da, patenti, lingue con livello, stato, adesione alla mail mensile.
- **Dati C2 (cifrati in `worker_profiles.pii_enc`)**: nome, cognome, telefono, presentazione, esperienze e
  formazione in testo libero (contengono nomi di ex datori). AES-256-GCM con la **DEK dell'utente**
  (`users.dek_wrapped`), testo cifrato **legato** a tabella, colonna e utente: copiato su un altro utente non si
  decifra. Cancellando la DEK (crypto-shredding) diventano illeggibili.
- **Solo `modules/privacy` decifra** (03-ARCHITETTURA §4): `readWorkerPii` ammette oggi un solo scopo,
  `worker.self-view` (il lavoratore stesso), e scrive nel log di audit **prima** di decifrare (fail closed). Con
  WP-019 si aggiunge l'azienda destinataria di una candidatura, con il suo scopo. **Regola di lint**: `decryptPii`
  importato fuori da `modules/privacy` o `lib/crypto` è un errore (vale anche per i modelli locali, AGENTS.md).
- **Campi vietati per costruzione** (R-LAV-05, R-ANN-02): nessun campo per data di nascita, età, sesso, nazionalità,
  foto, salute, stipendio precedente; un test legge tutti i nomi di campo (anche annidati) e fallisce se ne compare
  uno. I campi sconosciuti nei dati cifrati si scartano.
- Testo sulla privacy nella pagina: la **formula approvata** di docs/04 §1 (niente promesse esagerate).
- Stati (docs/01 §6.1): 🟢 cerco lavoro, 🟡 occupato ma aperto, ⚪ non visibile. Adesione alla mail mensile: la prima
  parte 30 giorni dopo (la manda WP-021).
- Il form non si azzera dopo l'invio (stesso problema di React 19 corretto in WP-016).
- Correzione di WP-011c: **massimo 5 sedi** per azienda, come 01-PRODOTTO §5.4 (prima erano 20), con test.
- Test: 5 unitari (valori ammessi, limiti, campi vietati), 5 di integrazione (niente dati in chiaro nel DB, audit
  della lettura, nessun accesso di altri, testo cifrato non trasferibile, crypto-shredding, comune, stato, mail
  mensile), 1 e2e × 2 dispositivi (compilazione, comune sbagliato, rilettura, verifica nel DB).
- Da fare: CV in PDF (WP-018), candidatura e lettura da parte dell'azienda (WP-019), "cerca vicino a me" dal profilo
  e competenze nel punteggio della ricerca (WP-020), esportazione e cancellazione del profilo (WP-023).

## WP-019 — Candidature, casella dell'azienda e notifiche ✅
**Esecutore:** Claude (parte PII e autorizzazione) · **Codice:** `src/modules/applications/**`,
`src/modules/privacy/server/application-pii.ts`, pagine `/candidature`, `/azienda/candidature` e
`/azienda/candidature/[id]`, sezione "Candidati" in `/offerte/[id]`

- **Candidarsi** (pagina dell'offerta): chi non è entrato vede "Entra per candidarti"; senza profilo il link a
  `/profilo`; con il profilo un pulsante e un messaggio facoltativo (max 1000 caratteri, **cifrato** con la chiave del
  lavoratore e legato alla riga della candidatura). Solo lavoratori attivi, solo offerte pubblicate, non scadute, di
  aziende verificate. Una candidatura per offerta; dopo il ritiro ci si può ricandidare (stessa riga). Due invii
  simultanei ne salvano uno solo (indice unico + scrittura condizionata), con un solo avviso.
- **Le mie candidature** (`/candidature`): offerta, azienda, comune, stato, "vista il…", ritiro finché lo stato non è
  finale. Stati (03-ARCHITETTURA §6.1): inviata → vista → in valutazione / "ti contatterà" → non selezionata / assunta;
  ritirata; chiusa (la imposterà WP-022).
- **Casella dell'azienda**: l'elenco mostra **solo dati C1** (fascia di esperienza, provincia, date, stato), nessun
  nome. Nome, contatti, messaggio, esperienze e formazione si vedono **aprendo** la candidatura: `modules/privacy`
  verifica che l'utente sia membro attivo dell'azienda **che ha pubblicato l'offerta** e che la candidatura sia ancora
  visibile, poi registra la lettura (scopo `application.company-view`) **prima** di decifrare. La prima apertura porta
  la candidatura a "vista", e il lavoratore lo vede. La pagina ricorda all'azienda che da quel momento è titolare dei
  dati ricevuti (testo da far rivedere al professionista insieme alle altre bozze legali).
- **Chi non vede nulla**: altre aziende, il lavoratore stesso dalla casella, membri non più attivi; candidature
  ritirate; candidature oltre la finestra di conservazione (`company_visible_until`, 6 mesi dopo la chiusura
  dell'offerta, R-PRIV-03: la data la imposterà WP-022 alla chiusura). Account cancellato (chiave distrutta): la
  candidatura resta come riga, i dati non sono più leggibili.
- **Decisioni dell'azienda**: in valutazione, "lo contatteremo", non selezionato, assunto. Gli stati finali non si
  cambiano più; decisione e ritiro sono scritture condizionate allo stato letto (niente sovrascritture incrociate).
- **Avviso all'azienda**: un'email a ciascun membro attivo con il titolo dell'offerta e il link alla casella,
  **nessun dato del candidato** (gli indirizzi dei membri li decifra `modules/privacy` come `system:notify`, con
  audit). Se l'email non parte la candidatura resta valida (l'azienda la vede nell'area). Per ora l'invio è nella
  richiesta: con WP-020 passa alla coda pg-boss.
- JSON-LD `JobPosting`: `directApply: true` (ci si candida sul sito).
- Test: 4 unitari (transizioni di stato, visibilità, input), 6 di integrazione (email senza dati del candidato a tutti
  i membri, chi può candidarsi, doppio invio simultaneo, apertura con audit e stato "vista", nessun accesso di
  estranei / dopo ritiro / dopo scadenza, decisioni, chiave distrutta), 1 e2e × 2 dispositivi (candidatura con
  messaggio → email all'azienda → apertura → "lo contatteremo" → il lavoratore vede lo stato).
- Da fare: email al lavoratore quando cambia lo stato (con gli avvisi, WP-020), chiusura delle candidature e data di
  fine visibilità alla scadenza dell'offerta (WP-022), esportazione e cancellazione (WP-023), CV in PDF allegabile
  (WP-018).
