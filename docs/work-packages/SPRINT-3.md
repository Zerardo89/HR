# Sprint 3 — Lavoratori e candidature (lun 12/10 – dom 18/10)

> Obiettivo (traguardo M3): *tutto il percorso lavoratore funziona in staging: registrazione → profilo → ricerca →
> candidatura → risposta dell'azienda → avviso → mail mensile.* Calendario in [../06-ROADMAP.md](../06-ROADMAP.md) §3.

## Stato (aggiornato lunedì 28/09/2026)

| WP | Stato | Note |
|----|-------|------|
| 017 | ✅ Fatto (Claude, 28/09) | Profilo del lavoratore `/profilo`: dati di ricerca in chiaro, dati identificativi **cifrati** dal modulo `privacy` con audit di ogni lettura; stati cerco / aperto / nascosto; "disponibile a trasferirmi in…". |
| 018 | ⏳ Da fare | CV in PDF generato dal profilo (senza foto). |
| 019 | ⏳ Da fare | Candidatura + "le mie candidature" + casella azienda (lettura dei dati cifrati da parte dell'azienda destinataria). |
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
