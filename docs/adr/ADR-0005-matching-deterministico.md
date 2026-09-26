# ADR-0005 — Matching deterministico e spiegabile, nessuna IA sulle persone

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
L'AI Act classifica **ad alto rischio** i sistemi di IA per annunci mirati, filtro e valutazione dei candidati
(Allegato III, punto 4) — obblighi dal 02/12/2027 dopo il Digital Omnibus. L'art. 22 GDPR limita le decisioni
unicamente automatizzate. L'art. 10 D.Lgs. 276/2003 vieta preselezioni su caratteristiche protette.

## Decisione
- Filtri rigidi scelti dall'utente + punteggio a **pesi fissi e pubblici** (vedi [01-PRODOTTO.md §8](../01-PRODOTTO.md)).
- Ogni risultato espone le **ragioni** ("Stessa mansione · A 12 km · Pubblicata 2 giorni fa").
- Il modulo `matching/domain` è puro e testato; nessun modello statistico o ML addestrato sui comportamenti.
- Le sponsorizzazioni sono uno slot separato, non cambiano il punteggio.

## Alternative scartate
- Embedding semantici / LLM per il ranking: migliorerebbero la pertinenza su testi liberi, ma portano il sistema verso l'alto rischio e rendono le spiegazioni opache. Si potrà rivalutare **solo** per la ricerca delle offerte da parte del lavoratore (non per classificare persone) con valutazione R-AI-02.

## Conseguenze
- ✅ Conformità semplice, fiducia, messaggio di marketing chiaro.
- ⚠️ La qualità dipende da una buona tassonomia delle mansioni e dai sinonimi → investimento su ESCO + sinonimi (Gemini).

## Verifica
Test "d'oro" (golden tests) con 50 coppie profilo/offerta e ordinamento atteso; test che la funzione di punteggio non riceve campi diversi da quelli ammessi.
