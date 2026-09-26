# ADR-0007 — Profili anonimi e doppio consenso per il contatto (Fase B)

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Le aziende vogliono consultare le "liste per mansione". I lavoratori (soprattutto gli "occupati ma aperti")
non vogliono essere riconosciuti dal datore attuale. Il database dei CV è il bersaglio preferito di truffatori e scraper.

## Decisione
- Nelle liste, l'azienda vede una **scheda anonima**: mansione, anni di esperienza, competenze, lingue, patenti, **provincia** (non il comune se < 5.000 abitanti), disponibilità, stato (cerco/occupato). **Niente** nome, contatti, nomi di ex datori, testi liberi.
- L'azienda invia una **richiesta di contatto** (con offerta collegata o messaggio). Il lavoratore **accetta o rifiuta**. Solo se accetta, l'azienda vede il profilo completo.
- Il lavoratore può **bloccare aziende** (es. il datore attuale, per P.IVA) → quella azienda non lo vedrà mai.
- Quote di richieste per piano (20 gratis/mese in zona; 100 con Nazionale) e limiti di visualizzazione per scoraggiare lo scraping.

## Alternative scartate
- Profili completi visibili alle aziende registrate (modello classico): rischio privacy e truffe troppo alto.

## Conseguenze
- ✅ Privacy, meno discriminazioni, fiducia degli "occupati".
- ⚠️ Un passaggio in più per le aziende: compensato da notifiche rapide e risposta in 1 tocco per il lavoratore.

## Verifica
Test di autorizzazione: nessuna API restituisce campi C2 di un lavoratore a un'azienda senza candidatura o contatto accettato.
