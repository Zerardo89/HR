# Sprint 3 — Lavoratori e candidature (lun 12/10 – dom 18/10)

> Obiettivo (traguardo M3): *tutto il percorso lavoratore funziona in staging: registrazione → profilo → ricerca →
> candidatura → risposta dell'azienda → avviso → mail mensile.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 017 | ✅ Fatto (Claude, 28/09) | Profilo del lavoratore `/profilo`: dati di ricerca in chiaro, dati identificativi **cifrati** dal modulo `privacy` con audit di ogni lettura; stati cerco / aperto / nascosto; "disponibile a trasferirmi in…". |
| 018 | ⏳ Da fare | CV in PDF generato dal profilo (senza foto). |
| 019 | ✅ Fatto (Claude, 28/09) | Candidatura dalla pagina dell'offerta, "le mie candidature" con stato e ritiro, casella dell'azienda: dati identificativi decifrati **solo** per l'azienda destinataria, con audit; email all'azienda senza dati del candidato. |
| 020 | ✅ Fatto (Claude, 28/09) | Worker pg-boss con job pianificati in ora italiana, pulizia giornaliera; avvisi per le ricerche salvate con disiscrizione in un clic (RFC 8058); **020c** email di esito (offerta, sede, azienda verificata, candidatura). |
| 021 | ✅ Fatto (Claude, 28/09) | Mail ogni 30 giorni per gli "aperti": offerte per il profilo (con trasferimento e Piano Nazionale), quattro risposte con pagina di conferma, pausa dopo 6 mail, disiscrizione in un clic. |
| 022 | ✅ Fatto (Claude, 28/09) | Chiusura e rinnovo dall'area azienda, scadenza automatica, promemoria di scadenza, "posizione chiusa" ai candidati, finestra di 6 mesi e cancellazione dei messaggi (R-ANN-07, R-PRIV-03). |

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
  ritirata; chiusa (offerta chiusa o scaduta, WP-022).
- **Casella dell'azienda**: l'elenco mostra **solo dati C1** (fascia di esperienza, provincia, date, stato), nessun
  nome. Nome, contatti, messaggio, esperienze e formazione si vedono **aprendo** la candidatura: `modules/privacy`
  verifica che l'utente sia membro attivo dell'azienda **che ha pubblicato l'offerta** e che la candidatura sia ancora
  visibile, poi registra la lettura (scopo `application.company-view`) **prima** di decifrare. La prima apertura porta
  la candidatura a "vista", e il lavoratore lo vede. La pagina ricorda all'azienda che da quel momento è titolare dei
  dati ricevuti (testo da far rivedere al professionista insieme alle altre bozze legali).
- **Chi non vede nulla**: altre aziende, il lavoratore stesso dalla casella, membri non più attivi; candidature
  ritirate; candidature oltre la finestra di conservazione (`company_visible_until`, 6 mesi dopo la chiusura
  dell'offerta, R-PRIV-03: la data la imposta WP-022 alla chiusura o scadenza). Account cancellato (chiave distrutta): la
  candidatura resta come riga, i dati non sono più leggibili.
- **Decisioni dell'azienda**: in valutazione, "lo contatteremo", non selezionato, assunto. Gli stati finali non si
  cambiano più; decisione e ritiro sono scritture condizionate allo stato letto (niente sovrascritture incrociate).
- **Avviso all'azienda**: un'email a ciascun membro attivo con il titolo dell'offerta e il link alla casella,
  **nessun dato del candidato** (gli indirizzi dei membri li decifra `modules/privacy` come `system:notify`, con
  audit). Se l'email non parte la candidatura resta valida (l'azienda la vede nell'area). L'invio resta nella
  richiesta, come le email di esito (vedi WP-020c).
- JSON-LD `JobPosting`: `directApply: true` (ci si candida sul sito).
- Test: 4 unitari (transizioni di stato, visibilità, input), 6 di integrazione (email senza dati del candidato a tutti
  i membri, chi può candidarsi, doppio invio simultaneo, apertura con audit e stato "vista", nessun accesso di
  estranei / dopo ritiro / dopo scadenza, decisioni, chiave distrutta), 1 e2e × 2 dispositivi (candidatura con
  messaggio → email all'azienda → apertura → "lo contatteremo" → il lavoratore vede lo stato).
- Da fare: ~~email al lavoratore quando cambia lo stato~~ (fatto in WP-020c), chiusura delle candidature e data di
  fine visibilità alla scadenza dell'offerta (WP-022), esportazione e cancellazione (WP-023), CV in PDF allegabile
  (WP-018).

## WP-020 — Worker pg-boss, avvisi delle ricerche salvate, email di esito ✅
**Esecutore:** Claude · **Codice:** `src/worker/**`, `src/modules/notifications/**`, `src/modules/*/jobs.ts`,
`src/modules/privacy/server/notify.ts`, pagine `/avvisi` e `/avvisi/disiscrizione`, route
`/api/avvisi/disiscrizione`, riquadro "Ricevi le nuove offerte via email" in `/offerte`, migrazioni 0008-0009

- **Worker** (`pnpm worker`, processo separato dal sito): pg-boss 12.33.3 (ADR-0003, pacchetto verificato: autore
  timgit, versione di una settimana). Job pianificati con fuso `Europe/Rome` (il cambio dell'ora del 25/10 non
  sposta nulla; nessun job tra le 2 e le 3, l'ora che il cambio salta o ripete). Coda `singleton` (un giro alla
  volta), 2 tentativi a 5 e 10 minuti, `missed: "once"` (worker fermo all'ora prevista → un giro al riavvio). Nei
  log solo numeri e tipi di errore. `pnpm worker --once <job>` esegue subito un job (verifiche, e2e).
  - `maintenance.cleanup` alle 3:30: sessioni, biglietti e codici di accesso scaduti; token delle email scaduti.
  - `alerts.send` alle 8:00: avvisi.
- **API `jobs.ts`** (aggiornamento WP-020 di ADR-0001): il worker non può caricare gli `index.ts` dei moduli
  (componenti React e Next.js); ogni modulo che serve al worker espone `jobs.ts`. Regola di lint aggiornata.
- **Avvisi**: dalla pagina di ricerca il lavoratore salva la ricerca ("Ogni giorno" / "Una volta a settimana"). Si
  salva la ricerca così com'è (parametri di `/offerte`, comune nella forma "Nome (PR)"), quindi l'avviso contiene
  esattamente ciò che la pagina mostrerebbe, limitato alle offerte pubblicate dopo l'ultimo controllo
  (`checked_until`, finestra chiusa: nessuna offerta in due avvisi). Serve un "cosa" o un "dove"; massimo 5 avvisi.
  La richiesta è registrata come consenso `job_alerts`, chiuso quando non restano avvisi o con la disiscrizione.
- **Regole** (01-PRODOTTO §6.1): avvisi solo per chi è "Cerco lavoro" o non ha ancora il profilo; "aperto" e
  "nascosto" no (la pagina `/avvisi` lo dice e rimanda al profilo). Nessun avviso a chi ha cancellato l'account.
- **Zona gratuita**: le ricerche salvate seguono il raggio scelto dal lavoratore, come la pagina di ricerca (il
  lavoratore non si limita mai, ADR-0009). L'estensione a pagamento "disposti a trasferirsi" riguarda gli avvisi dal
  profilo e la mail mensile (WP-021).
- **Email**: una sola al giorno per persona con tutte le sue ricerche dovute, fino a 5 offerte per ricerca (titolo,
  azienda, comune, stipendio, link) e il link per le altre; niente pubblicità (02 §5, art. 130), niente nome del
  destinatario; l'indirizzo lo decifra `modules/privacy` come `system:notify` (scopo `notification.job-alert`, con
  audit). Prima si spedisce, poi si segna il controllo: SMTP giù → nessuna offerta persa, il job si ripete.
- **Disiscrizione** (R-MAIL-01, RFC 8058): intestazioni `List-Unsubscribe` (URL https con token monouso, 60 giorni,
  nel DB solo l'hash) e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Il POST del programma di posta toglie
  tutti gli avvisi e chiude il consenso, risposta 200 senza dettagli. Il link nel testo apre una pagina di conferma
  che da sola non cambia nulla (R-MAIL-02). Rifarla è innocuo.
- Test: 9 unitari (forma canonica, "cosa o dove", descrizione, quando parte con giorni di 23 e 25 ore, stati, email) +
  2 sugli orari dei job, 7 di integrazione (salvataggio e limiti, finestra e raggio, una email per più ricerche,
  settimanale, stati e account cancellato, SMTP giù, disiscrizione e token scaduto, gestione), 2 e2e × 2 dispositivi
  (dalla ricerca all'email con il job vero, POST "un clic", pagina di conferma; invito ad accedere).
- **020c — email di esito** (`notifications/domain/outcomes.ts` per i testi, `notifications/server/outcomes.ts` per
  l'invio, chiamati dalle Server Action DOPO che la decisione è salvata):
  - offerta approvata o rifiutata → tutti i membri attivi dell'azienda, con il **motivo** e l'eventuale nota del
    moderatore (DSA art. 17) e il link all'offerta tornata in bozza;
  - sede approvata o rifiutata → solo i **titolari** (sono loro a gestire le sedi), con il motivo;
  - azienda verificata a mano → tutti i membri attivi;
  - candidatura → il lavoratore, solo per "ti contatterà", "altri candidati" e "assunta/o" ("vista" e "in
    valutazione" si vedono in `/candidature`, senza riempire la casella), con l'avviso anti-truffa.
  - Mai dati di altre persone: solo titolo dell'offerta, nome pubblico dell'azienda, comune della sede, motivo.
    Indirizzi decifrati da `modules/privacy` (`companyMemberEmails`, `notificationEmail`) con uno scopo per tipo
    (`notification.offer-outcome`, `…site-outcome`, `…company-verified`, `…application-status`), ognuno nel log di
    audit; membri sospesi o account cancellati esclusi.
  - **Invio nella richiesta, non in coda**: come l'email di nuova candidatura (WP-019). Se l'SMTP non risponde la
    decisione resta valida e visibile nell'area riservata; l'errore va solo nel log. Una coda con tentativi (outbox
    nel DB + job del worker) si aggiunge se in produzione l'SMTP dà problemi.
  - Test: 6 unitari (testi, motivi, note, stati che danno un'email), 5 di integrazione (destinatari, titolari,
    audit, nessuna email senza decisione, stati non notificati, SMTP giù), e2e delle candidature esteso (email
    "Novità sulla tua candidatura" dopo "Lo contatteremo").
- Da fare: avvisi dal profilo e mail mensile (WP-021); job di conservazione (docs/04 §8, WP-022/023); in
  produzione: servizio del worker e utente DB che può creare lo schema `pgboss` (WP-010).

## WP-022 — Scadenza, chiusura e rinnovo delle offerte ✅
**Esecutore:** Claude · **Codice:** `src/modules/offers/{domain/lifecycle.ts,server/lifecycle*.ts,jobs.ts}`,
`src/modules/applications/{server/closure.ts,jobs.ts}`, `src/modules/notifications/server/lifecycle-emails.ts`,
job del worker, pagina `/azienda/offerte/[id]`, migrazione 0010

- **Regola R-ANN-07**: scadenza al più a 60 giorni; passata la data l'offerta sparisce **subito** da ricerca, avvisi e
  pagina pubblica (lo stato effettivo si calcola in lettura), anche prima del job; l'area azienda la mostra "Scaduta".
- **Chiusura** (titolare o selezionatore, offerta pubblicata): sparisce, le candidature **aperte** (inviata, vista, in
  valutazione, "ti contatterà") diventano "chiusa"; quelle già decise restano come sono. Per tutte parte la finestra
  di **6 mesi** in cui l'azienda può ancora vederle (R-PRIV-03). Una transazione, audit `offer.close`.
- **Rinnovo** solo negli **ultimi 7 giorni** prima della scadenza, per 15/30/45/60 giorni, con nuova data di
  pubblicazione: rinnovare ogni giorno per restare in cima alla ricerca (la freschezza pesa nel punteggio) non si può.
  Prima della finestra la pagina dice da quando si potrà. Un'offerta scaduta non si rinnova: se ne pubblica una nuova.
  Audit `offer.renew`. (Bug trovato dall'e2e e corretto: la condizione del rinnovo confrontava la data letta, ma
  Postgres ha i microsecondi e JavaScript i millisecondi; ora la condizione è "scadenza ancora nella finestra".)
- **Job `offers.lifecycle`** (ogni giorno alle 7:30): le pubblicate oltre la scadenza diventano "scaduta" e le loro
  candidature si chiudono; **promemoria all'azienda** 3 giorni prima della scadenza (una volta sola, si azzera al
  rinnovo: "rinnova o chiudi, così nessuno resta senza risposta"); **"posizione chiusa"** ai candidati le cui
  candidature si sono chiuse (dice se l'offerta è stata chiusa o è scaduta). Le email partono di mattina, non nella
  richiesta dell'azienda (possono essere tante). Ogni email segnata subito dopo l'invio: niente doppioni se il
  processo si ferma; SMTP giù → il job si ripete e rispedisce solo le mancanti. Indirizzi da `modules/privacy`
  (scopi `notification.offer-expiry` e `notification.position-closed`, con audit).
- **Job `retention.applications`** (ogni giorno alle 3:45, docs/04 §8): finita la finestra dell'azienda, il messaggio
  cifrato della candidatura si cancella (non serve più a nessuno); il lavoratore continua a vedere la candidatura.
- Test: 7 unitari (stato effettivo, finestra di rinnovo, durate, promemoria, chiusura) + 2 sulle email, 6 di
  integrazione (chi può chiudere, candidature aperte e decise, finestra di 6 mesi, rinnovo con data scritta dal DB,
  scadenza dal job, promemoria e "posizione chiusa" una volta sola, SMTP giù, conservazione), e2e: l'azienda chiude
  → pagina pubblica "non più disponibile" → il candidato vede "Offerta chiusa" → job → email; rinnovo dalla pagina.
- Da fare: "duplica come nuova offerta" per ripubblicare una scaduta; cancellazione delle candidature con l'account
  (WP-023).

## WP-021 — Mail mensile per gli "aperti" ✅
**Esecutore:** Claude · **Codice:** `src/modules/notifications/{domain,server}/monthly.ts`,
`src/modules/profiles/{domain,server}/monthly.ts` + `profiles/jobs.ts`, `src/modules/matching/server/profile-offers.ts`,
pagina `/mensile`, route `/api/mensile/disiscrizione`, job `monthly.check`, migrazione 0011

- **Chi la riceve** (01-PRODOTTO §6.1-6.2): profili "occupato ma aperto" con la mail scelta nel profilo, utenti attivi;
  ogni 30 giorni dall'adesione (ogni profilo ha il suo giorno, gli invii si distribuiscono nel mese), alle 9 ora
  italiana. Dopo un lungo fermo del worker non ne partono tante di fila (prossima data = 30 giorni da adesso).
- **Offerte**: pubblicate negli ultimi 30 giorni, della stessa mansione del profilo o simile (stesso gruppo ISCO), nel
  raggio del lavoratore; nelle regioni "disposto a trasferirmi" **solo** quelle di aziende con il Piano Nazionale
  attivo (01-PRODOTTO §5.3, ADR-0009: è il valore a pagamento). Fino a 10 nella mail, poi "vedi tutte" (la ricerca con
  mansione, comune e raggio del profilo). Ordine spiegabile: stessa mansione, nel raggio, più recente.
- **Senza nome** del destinatario (minimizzazione: niente decifratura del profilo); l'indirizzo lo legge
  `modules/privacy` (scopo `notification.monthly-check`, con audit). Niente pubblicità (art. 130).
- **Quattro risposte** (cerco / resto aperto / nascondimi / cancella il profilo) e "non scrivermi più": ogni link apre
  una **pagina di conferma** che da sola non cambia nulla (R-MAIL-02). **Un token per mail** (nel DB solo l'hash,
  azione `monthly_check`, 30 giorni): autorizza una risposta (consumata nella stessa transazione: due clic non la
  applicano due volte) e la disiscrizione anche dopo. "Cancella il profilo" elimina il profilo (dati cifrati compresi);
  l'account e le candidature restano (la cancellazione dell'account arriva con WP-023).
- **Pausa**: qualsiasi risposta o salvataggio del profilo azzera il conto; dopo **6 mail senza risposta** la settima
  non parte: profilo nascosto, mail mensile spenta, un'ultima mail "ti abbiamo messo in pausa".
- **Disiscrizione in un clic** (RFC 8058): `List-Unsubscribe` + `List-Unsubscribe-Post` → `POST
  /api/mensile/disiscrizione` spegne la mail mensile (il profilo resta).
- Prima si spedisce, poi si sposta la data: SMTP giù → la mail parte al giro dopo.
- Test: 4 unitari (calendario, pausa) + 4 sulla mail (testo, senza offerte, pausa, scelte), 6 di integrazione (chi la
  riceve, selezione delle offerte con raggio, mansioni simili, 30 giorni e Piano Nazionale, risposte e token, cancella
  il profilo, pausa dopo 6, SMTP giù), 1 e2e × 2 dispositivi (profilo "aperto" con la mail → job vero → email senza
  nome → conferma "resto visibile" → risposta già data → disiscrizione un clic → casella spenta nel profilo).
- Da fare: il nome nell'oggetto ("Marco, stai cercando…", 01-PRODOTTO §6.2) solo se lo chiede il prodotto: richiede di
  decifrare il profilo per ogni invio; l'accesso all'account come "interazione" che azzera il conto (tocca il modulo di
  accesso).

