# Sprint 2 — Aziende e offerte (lun 05/10 – dom 11/10)

> Obiettivo (traguardo M2): *un'azienda verificata pubblica un'offerta a norma e un visitatore la trova cercando
> "cameriere" vicino a casa.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato domenica 27/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 011 | ⏳ Da fare | Onboarding azienda + VIES + sedi + membri + 2FA TOTP (ADR-0013 §8). |
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
