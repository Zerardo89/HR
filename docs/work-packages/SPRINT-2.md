# Sprint 2 — Aziende e offerte (lun 05/10 – dom 11/10)

> Obiettivo (traguardo M2): *un'azienda verificata pubblica un'offerta a norma e un visitatore la trova cercando
> "cameriere" vicino a casa.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato domenica 27/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 011 | ✅ Fatto (Claude, 27/09) | ✅ **11a** registrazione dell'azienda (`/azienda`): P.IVA con cifra di controllo, verifica su **VIES** (valida → verificata, ragione sociale e sede legale da VIES; non raggiungibile → "in verifica"; agenzie sempre in verifica, R-LAV-03), titolare, una P.IVA non si registra due volte. ✅ **11b** 2FA TOTP obbligatoria per aziende, moderatori e admin (facoltativa per i lavoratori). ✅ **11c** sedi operative (con approvazione del moderatore) e inviti ai colleghi. ⏳ Verifica manuale delle aziende "in verifica" nel pannello del moderatore (WP-013). |
| 012 | ✅ Dominio fatto (Claude, 27/09) | Validatore puro + 22 test di accettazione. L'uso nel form e nel salvataggio arriva con WP-013. |
| 013 | ✅ Fatto (Claude, 27/09) | ✅ **13a** form offerta (`/azienda/offerte/nuova`, modifica di bozze e offerte in moderazione) con **controllo dal vivo** del validatore, selettore delle mansioni accessibile (ricerca nel browser), luogo di lavoro = sede verificata, bozza → in moderazione / pubblicata con scadenza. ✅ **13b** pannello del moderatore `/moderazione` (approva / rifiuta con motivo visibile all'azienda, verifica manuale delle aziende), log di audit. |
| 014 | 🟡 Pagina offerta fatta (Claude, 27/09) | ✅ `/offerte/[id]` SSR con dati strutturati **JobPosting** (Google for Jobs), sitemap e robots. ⏳ Pagine SEO "Lavoro [mansione] a [provincia]" (testi da Gemini). |
| 015 | ✅ Fatto (Claude, 27/09) | Ricerca `/offerte` "Cosa + Dove" (mansione dalla tassonomia, full-text + trigrammi, raggio PostGIS), filtri, punteggio a pesi pubblici con "perché la vedi", pagina `/come-funziona`. |
| 016 | ✅ Fatto (Claude, 27/09) | Offerte in "altro comune" con regola di zona (regione ∪ 50 km), Piano Nazionale per il fuori zona, periodo fondatori calcolato dalla data di registrazione, stato del piano nell'area azienda. Pagamenti ancora spenti (`BILLING_ENABLED`). |

---

## WP-012 — Validatore annunci a norma ✅ (dominio)
**Esecutore:** Claude (codice e test) · **Codice:** `src/modules/offers/domain/`

`validateOffer(bozza, contesto)` → `{ decision, issues, hints }`:
- `blocked`: almeno un errore, l'azienda deve correggere; `moderation`: si pubblica solo dopo un moderatore;
  `publish`: nessun problema. Ogni problema ha `code`, `rule` (ID in `docs/02-REGOLE-DEL-GIOCO.md`), `field` e il pezzo
  di testo (`match`) da evidenziare nel form.
- Regole coperte: **R-ANN-01** stipendio (obbligatorio per il subordinato, massimo ≥ minimo, periodo, importi plausibili),
  **R-ANN-02** storico retributivo (anche nelle domande di preselezione), **R-ANN-03/04** età, nazionalità, madrelingua,
  aspetto, sesso, auto propria (in apprendistato l'età va in moderazione), **R-LAV-05** foto, stato civile, figli,
  **R-LAV-11** soldi chiesti ai candidati, **§3.2 anti-truffa** WhatsApp/Telegram, numeri di telefono, link, IBAN,
  documenti, prime 3 offerte in moderazione, **R-LAV-02/03** azienda verificata e agenzie autorizzate,
  **R-LAV-10** tirocini (minimo regionale e dichiarazione), **R-ANN-07** scadenza ≤ 60 giorni.
- Consigli non bloccanti: titolo per entrambi i sessi (R-ANN-03), CCNL (R-ANN-06).
- Nessuna IA: solo regole scritte a mano (R-AI-01).

**Come si allunga la lista dei termini** (es. con la proposta di Gemini del 06/10): si aggiunge una riga a
`TERM_RULES` in `src/modules/offers/domain/terms.ts` e **un caso di test** (sia "deve scattare" sia "non deve
scattare") in `validator.test.ts`. Il testo è normalizzato: minuscole, senza accenti, punteggiatura → spazio.

**Test di accettazione (non modificabili):** `src/modules/offers/domain/validator.test.ts` — 22 casi, compresi i falsi
positivi da evitare ("esperienza di almeno 5 anni", "max 40 ore", "RAL 28.000 €", "lavoro fisico", "corso gratuito",
"versamento dei contributi", "CV senza foto").

**Rimandato:** lavoro domestico con stipendio facoltativo (R-ANN-01) quando arrivano le famiglie datrici (2027);
tabella dei minimi regionali dei tirocini da compilare con le fonti (`regional_internship_minimums`).

---

## WP-011a — Registrazione dell'azienda ✅
**Esecutore:** Claude · **Codice:** `src/modules/companies/`

- `domain/`: P.IVA italiana (cifra di controllo, prefisso IT, spazi e punti), risposta di VIES
  (valida / non valida / non disponibile), indirizzo VIES → CAP, comune, sigla.
- `server/register.ts`: solo utenti `company_member`; VIES valido → `verified` + ragione sociale da VIES (§3.2) + sede
  legale approvata (ADR-0009); VIES giù → `pending`; agenzia → `pending` (Albo); P.IVA già registrata → rifiuto
  (ci si fa invitare, WP-011c) senza chiamare VIES. Colonna `companies.verification` (migrazione 0005).
- Client VIES iniettabile; `VIES_API_URL` configurabile (negli e2e punta a una porta chiusa).
- ⚠️ Rischio noto: VIES dice che la P.IVA esiste, non che chi la registra lavora lì. Mitigazioni: ragione sociale da
  VIES (non modificabile), prime 3 offerte in moderazione (WP-012), segnalazioni (WP-024). Da valutare dopo il lancio:
  verifica via PEC o dominio email aziendale.
- Test: 8 unitari, 7 di integrazione (VIES finto), 2 e2e (registrazione con VIES irraggiungibile, area riservata).
- Corretto anche un difetto dei form con React 19 (i campi si svuotavano dopo un errore): ora i valori restano, anche
  nella lista d'attesa.

---

## WP-011b — Verifica in due passaggi (2FA TOTP) ✅
**Esecutore:** Claude · **Codice:** `src/modules/identity/server/{totp,mfa,enrollment}.ts`, pagine `/account/sicurezza`, `/accedi/verifica`

- TOTP RFC 6238 (SHA-1, 30 s, 6 cifre) scritto in casa e verificato con i vettori ufficiali dell'RFC; funziona con
  Google Authenticator, Microsoft Authenticator, Aegis, 2FAS.
- Segreto cifrato con la KEK come una chiave (`wrapKey`, legato all'id dell'utente); attivo solo dopo la conferma con
  un codice; lo stesso codice non vale due volte (`totp_last_step`); finestra ±1 periodo.
- 10 codici di recupero monouso, mostrati una volta sola, salvati come MAC (`KeyProvider.mac`, scopo `recovery`).
- La sessione nasce "da verificare" (`mfa_verified_at`); 5 tentativi sbagliati → sessione chiusa, si riparte dall'email.
- `requireUser` impone la 2FA: attiva ma non fatta → `/accedi/verifica`; obbligatoria ma non attiva → `/account/sicurezza`.
- QR code generato sul server (`qrcode` 1.5.4) + pulsante che apre l'app sul telefono + chiave da scrivere a mano.
- Test: 6 unitari (vettori RFC, base32, codici di recupero), 6 di integrazione, 2 e2e (azienda: attivazione obbligatoria,
  uscita, nuovo accesso con codice sbagliato e poi giusto; lavoratore: facoltativa). L'e2e dell'area azienda ora passa
  dall'attivazione della 2FA.
- Negli e2e il limite per IP è spento (tutti i test arrivano da 127.0.0.1); resta testato a parte.
- Da fare più avanti: disattivazione/rigenerazione dei codici per i lavoratori, passkey (dopo il lancio).

---

## WP-013a — Form dell'offerta ✅
**Esecutore:** Claude · **Codice:** `src/modules/offers/{server,ui}/`, `src/modules/taxonomy/ui/occupation-picker.tsx`

- Autorizzazione lato server: solo i membri dell'azienda, solo le sue sedi approvate, solo mansioni esistenti;
  si modificano solo bozze e offerte in moderazione (le pubblicate si chiudono/rinnovano con WP-022).
- "Pubblica": validatore WP-012 → errori = resta bozza con l'elenco dei problemi; da moderare = "in moderazione"
  (i giorni di validità chiesti restano in `moderation`, la scadenza parte dall'approvazione); tutto a posto =
  pubblicata subito con scadenza ≤ 60 giorni.
- Nel browser lo stesso validatore mostra problemi e consigli mentre l'azienda scrive (testi in `messages/it.json`,
  `offers.issues`).
- Selettore delle mansioni secondo il modello "combobox" WAI-ARIA (tastiera, lettore di schermo), con sinonimi,
  femminili ed errori di battitura; inserito nel form come "slot" dalla pagina server.
- Test: 3 unitari (dati del form), 5 di integrazione (moderazione delle prime offerte, pubblicazione con scadenza,
  blocco per discriminazione, bozza incompleta e modifica, autorizzazioni), 1 e2e (dal form alla moderazione).
  In CI il job e2e importa le mansioni (`pnpm taxonomy:import`).
- Miglioria da fare: nel riquadro dei problemi mostrare la frase originale (ora è quella normalizzata, senza accenti).

---

## WP-013b — Pannello del moderatore ✅
**Esecutore:** Claude · **Codice:** `src/modules/offers/server/moderation*.ts`, `src/modules/companies/server/verification*.ts`,
pagina `/moderazione`, script `pnpm users:role`

- Solo `moderator` e `admin` (con 2FA); il servizio ricontrolla il ruolo nel DB. Si vedono solo annunci e dati
  pubblici delle aziende, nessun dato personale dei lavoratori (docs/04 §5).
- Offerte in moderazione, dalla più vecchia: **approva** → pubblicata ora, scadenza = giorni chiesti dall'azienda
  (≤ 60); **rifiuta** con motivo (6 motivi) e nota facoltativa → torna bozza, l'azienda vede motivo e nota nella
  pagina dell'offerta (DSA art. 17). Un'azienda non più verificata non si approva.
- Aziende "in verifica": dati e esito VIES, promemoria di cosa controllare (VIES / Albo delle agenzie), **segna come
  verificata**.
- Ogni decisione nel log di audit (`offer.moderate`, `company.verify`, `user.role`).
- `pnpm users:role <email> <ruolo>`: promuove un utente già registrato (l'email non si salva né si stampa: indice cieco).
- Test: 4 di integrazione, 1 e2e (lavoratore escluso, promozione a moderatore, 2FA obbligatoria, approvazione e
  rifiuto con motivo).
- Da fare: email all'azienda con l'esito (WP-020, notifiche), segnalazioni DSA nello stesso pannello (WP-024).

## WP-014 — Pagina pubblica dell'offerta ✅ (senza pagine SEO)
**Esecutore:** Claude · **Codice:** `src/modules/offers/domain/job-posting.ts`, `src/modules/offers/server/public-offer.ts`,
pagina `/offerte/[id]`, `src/app/sitemap.ts`, `src/app/robots.ts`

- Visibile solo se **pubblicata, non scaduta e di un'azienda verificata**. Scaduta o chiusa → pagina "non è più
  disponibile" con `noindex` (anche se il job che cambia lo stato non è ancora passato). Bozza, in moderazione,
  rimossa, azienda non verificata o sospesa → 404.
- Stipendio sempre in vista (R-ANN-01): "Da 1600 € a 1800 € lordi al mese". Contratto, orario, CCNL, date in ora
  italiana, descrizione come testo (mai HTML dell'azienda).
- **JSON-LD JobPosting**: titolo, descrizione (HTML con testo dell'azienda sempre "escapato"), date, tipo di impiego,
  azienda, luogo (comune, provincia, IT), `baseSalary` in EUR con unità. Serializzato con `<` → `\u003c` (guida
  Next.js): il testo dell'azienda non può chiudere il tag script. `directApply: true` da WP-019 (candidatura sul
  sito).
- `sitemap.xml` (home + offerte visibili) e `robots.txt` (esclude aree private) calcolati a ogni richiesta; in
  anteprima (`PREVIEW_MODE`) sitemap vuota e tutto bloccato.
- Dalla pagina dell'offerta in `/azienda` c'è il link alla pagina pubblica quando è pubblicata.
- Test: 4 unitari (JSON-LD), 3 di integrazione (stati visibile / non più disponibile / 404), 4 e2e × 2 dispositivi
  (pagina, JSON-LD, `noindex`, 404, sitemap e robots).
- Da fare: pagine "Lavoro [mansione] a [provincia]" (con testi di Gemini, dopo WP-015), immagine per la condivisione.
  Il pulsante "Candidati" è arrivato con WP-019.

## WP-015 — Ricerca delle offerte e "perché la vedi" ✅
**Esecutore:** Claude · **Codice:** `src/modules/matching/domain/search.ts` (puro), `src/modules/matching/server/search.ts`,
pagine `/offerte` e `/come-funziona`

- Modulo **GET** (funziona senza JavaScript; l'indirizzo si può condividere): *Cosa* (mansione o parole), *Dove*
  (comune), distanza 5-100 km (predefinita 20), e in "Altri filtri" contratto, orario, stipendio minimo al mese,
  data di pubblicazione. Parametri non validi ignorati, mai un errore.
- **Filtri rigidi nel DB**: pubblicata, non scaduta, azienda verificata; raggio con `ST_DWithin` sulla sfera (stessa
  formula di `distanceKm`); testo = mansione riconosciuta **oppure** stesso gruppo ISCO **oppure** full-text
  `italian_unaccent` **oppure** trigrammi sul titolo ≥ 0,6 (ADR-0003). Fino a 1000 candidate (le più recenti).
- **Nessun limite di zona per chi cerca** (ADR-0009: la zona gratuita riguarda avvisi e mail, WP-016/020).
- **Punteggio nel dominio puro** (ADR-0005) con i pesi pubblici di 01-PRODOTTO §8: mansione 40 (uguale o parole nel
  titolo = pieno; simile o solo descrizione = metà), vicinanza 25 (1 − distanza/raggio), freschezza 10 (a zero in
  30 giorni). Competenze (20) e preferenze (5) entrano con il profilo (WP-017). A parità: la più recente.
- **Perché la vedi** su ogni risultato ("Stessa mansione (Cameriere di sala) · A 12 km · Pubblicata ieri") e pagina
  **Come ordiniamo le offerte** con la tabella dei pesi letta dal codice (R-DSA-06, R-PRIV-06).
- Stipendio minimo: confronto sulla cifra più alta; anno ÷ 13 mensilità, ora × ore settimanali (40) × 52 ÷ 12.
- Comune: maiuscole, accenti e apostrofi ignorati; refusi → "Forse cercavi"; omonimi → scelta con la provincia
  ("Castro (LE)").
- Risultati filtrati `noindex`; `/offerte` e `/come-funziona` nella sitemap; link "Cerca lavoro" nel menu.
- Test: 12 unitari (parametri, pesi, motivi, ordine, stipendio, pagine), 4 di integrazione (PostGIS + full-text:
  ordine e motivi, refusi, filtri, comuni), 3 e2e × 2 dispositivi.
- Da fare: autocompletamento del comune (ora si scrive e si corregge), "cerca vicino a me" dal profilo (WP-017),
  slot sponsorizzati separati (max 2, R-ADS-04) quando ci saranno i pagamenti.

## WP-011c — Sedi operative e inviti ai colleghi ✅
**Esecutore:** Claude · **Codice:** `src/modules/companies/server/{sites,invites,team-actions,invite-cookie}.ts`,
`src/modules/geo/server/lookup.ts`, pagine `/azienda/sedi`, `/azienda/colleghi`, `/invito/[token]`, sezione "Sedi da
approvare" in `/moderazione`, migrazione `0007`

- **Sedi**: le aggiunge solo il titolare (nome + comune, con "forse cercavi" e scelta tra omonimi); restano **in attesa**
  finché un moderatore non le approva (ADR-0009: niente sedi di comodo per allargare la zona gratuita). Il moderatore
  vede la distanza dalla sede legale, se la regione è diversa e quante sedi aspetta la stessa azienda. Rifiuto con
  motivo visibile all'azienda (DSA art. 17). Il titolare può togliere una sede operativa, mai la legale. Max 5 sedi (01-PRODOTTO §5.4).
- **Inviti**: solo il titolare di un'azienda **verificata**; l'email serve solo a spedire il link e **non si salva**
  (nel DB l'indice cieco, come `users.email_bidx`, e l'hash SHA-256 del token). Vale 7 giorni; un nuovo invito alla
  stessa persona sostituisce il vecchio; revoca; max 10 aperti e 20 spediti al giorno per azienda.
- **Accettazione**: solo un account azienda attivo con **la stessa email** dell'invito (un link inoltrato non basta),
  con la 2FA. Il collega entra come `recruiter` (offerte sì, sedi e inviti no). Chi apre il link senza essere entrato
  lo ritrova nell'area azienda dopo l'accesso (cookie tecnico `invito`, 1 giorno, solo il token). Log di audit
  `company.member_join`; decisioni sulle sedi `company.site`.
- La ricerca del comune (`findMunicipality`) passa al modulo `geo`: la usano la ricerca delle offerte e le sedi.
- Test: 5 di integrazione (autorizzazioni, stati delle sedi, pannello, invito con indice cieco, account sbagliato,
  scadenza, sostituzione, revoca, limiti, invio fallito), 2 e2e × 2 dispositivi (sede con comune sbagliato + invito
  accettato da un nuovo account con 2FA; approvazione della sede dal pannello).
- Da fare: togliere un collega dall'azienda, passaggio di titolarità, email all'azienda con l'esito della sede (WP-020).

## WP-016 — Zona gratuita, Piano Nazionale e periodo fondatori ✅
**Esecutore:** Claude · **Codice:** `src/modules/billing/{domain,server}/entitlements.ts`,
`src/modules/offers/server/save-offer.ts` (luogo di lavoro), form dell'offerta, area azienda

- **Luogo di lavoro**: una sede approvata (sempre in zona) oppure **"Altro comune…"** (con "forse cercavi" e scelta
  tra omonimi). La regola di zona è quella del dominio (`isInFreeZone`, ADR-0009): stessa regione di una sede
  approvata **oppure** entro 50 km in linea d'aria. In zona → offerta `local`, gratis.
- **Fuori zona** → offerta `national`: si pubblica solo con il **Piano Nazionale** attivo; senza, resta bozza con il
  motivo ("fuori dalla zona gratuita", regola ADR-0009) mostrato nel form. Le bozze si salvano sempre.
- **Periodo fondatori** (docs/05 §4): le aziende registrate entro il **31/12/2026** hanno il Nazionale gratis fino a
  `FOUNDERS_PERIOD_UNTIL` (31/01/2027). **Calcolato** dalla data di registrazione: nessuna riga da creare né da
  togliere a fine periodo. Le righe `entitlements` servono per gli acquisti (Stripe, promo, crowdfunding).
- Area azienda: "Piano: Gratis nella tua zona…" oppure "Azienda fondatrice: Piano Nazionale gratis fino al …".
- Nessun diritto tocca i lavoratori o l'ordine dei risultati (R-LAV-01): la ricerca non legge gli entitlement.
- **Difetti corretti nel form dell'offerta** (c'erano da WP-013a), trovati dall'e2e: (1) dopo un invio React 19
  riportava i menu a tendina alla prima voce mentre lo schermo mostrava le scelte fatte → al secondo invio partivano
  valori diversi (es. la sede invece di "altro comune"); ora l'invio non azzera il form. (2) Dopo un blocco la bozza
  salvata non era collegata al form → ripubblicando se ne creava una seconda; ora si aggiorna la stessa. (3) I problemi
  che conosce solo il server (la zona) ora si vedono nel messaggio di blocco.
- Test: 5 unitari (periodo fondatori, validità dei diritti), 4 di integrazione (in zona per regione o per distanza,
  fuori zona fondatrice / non fondatrice / con promo, fine del periodo, comune sbagliato, bozza), 1 e2e × 2
  dispositivi (in zona e fuori zona, nessuna offerta doppia, comune salvato). Date fisse nei test: nessuna "bomba a
  orologeria" dopo il 2026.
- Da fare con la P.IVA dell'associazione (ADR-0010): acquisto del Nazionale e di "In evidenza" con Stripe
  (`BILLING_ENABLED`), avvisi ai lavoratori disposti a trasferirsi (WP-020).
