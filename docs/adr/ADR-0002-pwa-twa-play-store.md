# ADR-0002 — Play Store tramite PWA + Trusted Web Activity

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Lancio su web **e** Play Store il 01/11. Un account sviluppatore **personale** nuovo deve fare un **test chiuso
con ≥12 tester per 14 giorni consecutivi** prima di poter pubblicare in produzione (R-PLAY-01). Questo è il
**percorso critico** del progetto.

## Decisione
- Il sito è una **PWA** (manifest, service worker, icone).
- L'app Android è una **Trusted Web Activity** generata con **Bubblewrap**: una "cornice" Chrome a schermo intero che apre il nostro sito, verificata tramite Digital Asset Links (`/.well-known/assetlinks.json`).
- **La TWA si carica sul Play Console già nella settimana 1** (anche se il sito è ancora incompleto): i contenuti si aggiornano dal server senza nuove revisioni Google, quindi i 14 giorni di test partono subito e i tester vedono il prodotto crescere.
- Target API 36; nome pacchetto definitivo deciso prima del primo upload (R-PLAY-06).

## Alternative scartate
- **Capacitor** (app ibrida con WebView): consente AdMob e Play Billing nativi, ma aggiunge build native, plugin e revisioni a ogni modifica. Resta il **piano B** se servissero AdMob o funzioni native.
- **App nativa Kotlin / React Native**: impossibile nei tempi.

## Conseguenze
- ✅ Parità totale web/app; aggiornamenti istantanei.
- ✅ Push web funziona anche nella TWA (delega delle notifiche a Chrome).
- ⚠️ Pubblicità: AdSense nelle app è ammesso solo tramite "frame" supportati; verificare la policy AdSense sui *web content viewing frames* prima di attivarla nell'app (in alternativa si mostrano nell'app solo gli slot interni/sponsor).
- ⚠️ Nessun acquisto in-app (ADR-0010).
- ⚠️ Se Google nega l'accesso alla produzione in tempo: lancio web il 01/11 e Play Store appena approvato (rischio R1 in [08-RISCHI.md](../08-RISCHI.md)).

## Verifica
Lighthouse PWA ok; `assetlinks.json` valido; installazione dal test chiuso senza barra degli indirizzi (se compare la barra, l'associazione del dominio è sbagliata).
