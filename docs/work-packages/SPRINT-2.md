# Sprint 2 — Aziende e offerte (lun 05/10 – dom 11/10)

> Obiettivo (traguardo M2): *un'azienda verificata pubblica un'offerta a norma e un visitatore la trova cercando
> "cameriere" vicino a casa.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato domenica 27/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 011 | 🟡 Parti a e b fatte (Claude, 27/09) | ✅ **11a** registrazione dell'azienda (`/azienda`): P.IVA con cifra di controllo, verifica su **VIES** (valida → verificata, ragione sociale e sede legale da VIES; non raggiungibile → "in verifica"; agenzie sempre in verifica, R-LAV-03), titolare, una P.IVA non si registra due volte. ✅ **11b** 2FA TOTP obbligatoria per aziende, moderatori e admin (facoltativa per i lavoratori). ⏳ **11c** sedi operative (con approvazione) e inviti ai colleghi. ⏳ Verifica manuale delle aziende "in verifica" nel pannello del moderatore (WP-013). |
| 012 | ✅ Dominio fatto (Claude, 27/09) | Validatore puro + 22 test di accettazione. L'uso nel form e nel salvataggio arriva con WP-013. |
| 013 | ⏳ Da fare | Form offerta + anteprima con il validatore + moderazione + pannello moderatore; usa il selettore delle mansioni (WP-006). |
| 014 | ⏳ Da fare | Pagina offerta SSR + JSON-LD JobPosting + sitemap. |
| 015 | ⏳ Da fare | Ricerca (full-text + trigrammi, ADR-0003) + "perché la vedi". |
| 016 | ⏳ Da fare | Zona gratuita (già nel dominio, WP-005) + entitlement + periodo fondatori. |

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
