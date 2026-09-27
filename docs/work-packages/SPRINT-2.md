# Sprint 2 — Aziende e offerte (lun 05/10 – dom 11/10)

> Obiettivo (traguardo M2): *un'azienda verificata pubblica un'offerta a norma e un visitatore la trova cercando
> "cameriere" vicino a casa.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato domenica 27/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 011 | 🟡 Parte a fatta (Claude, 27/09) | ✅ **11a** registrazione dell'azienda (`/azienda`): P.IVA con cifra di controllo, verifica su **VIES** (valida → verificata, ragione sociale e sede legale da VIES; non raggiungibile → "in verifica"; agenzie sempre in verifica, R-LAV-03), titolare, una P.IVA non si registra due volte. ⏳ **11b** 2FA TOTP obbligatoria per aziende e admin. ⏳ **11c** sedi operative (con approvazione) e inviti ai colleghi. ⏳ Verifica manuale delle aziende "in verifica" nel pannello del moderatore (WP-013). |
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

## WP-011b — 2FA TOTP per aziende, moderatori e admin ✅
**Esecutore:** Claude · **Codice:** `src/modules/identity/` (ADR-0013 punto 8)

- Dopo il codice email, chi non cerca lavoro dà anche il codice dell'app di autenticazione (TOTP RFC 6238: SHA-1,
  30 secondi, 6 cifre, ±30 secondi di tolleranza). La sessione nasce solo dopo.
- Prima volta (anche subito dopo la registrazione): QR + chiave da copiare, conferma con un codice, 10 codici di
  recupero mostrati una volta sola; si entra solo dopo "Li ho salvati, continua".
- Nel DB: segreto cifrato con la DEK dell'utente (`decryptCredential`, senza audit a ogni accesso: non è un dato
  personale), codici di recupero solo come HMAC, biglietto del passo in più solo come SHA-256. Un codice TOTP non vale
  due volte (`last_used_step`). Biglietto: 10 minuti, 5 tentativi. Migrazione 0006.
- Audit: `auth.mfa_enrolled`, `auth.recovery_code_used`, `auth.mfa_reset`; `auth.login` di moderatori e admin ora
  si scrive dopo il secondo fattore.
- Telefono e codici persi: `pnpm mfa:reset <email>` (admin, dopo aver verificato chi chiede).
- TOTP scritto in casa con `node:crypto` (vettori ufficiali di RFC 4226 e RFC 6238 nei test); unica dipendenza nuova
  `qrcode` per disegnare il QR.
- Test: 37 unitari, 18 di integrazione, 1 e2e (attivazione, accesso con il codice dell'app, accesso con un codice di
  recupero). Aggiornati il test di audit degli admin (WP-008) e l'e2e di registrazione azienda (WP-011a): ora passano
  dal secondo fattore, come richiede docs/04.
