# ADR-0012 — Hosting a costo (quasi) zero: Cloudflare Tunnel + macchina che si può spostare

**Stato:** Accettata · **Data:** 27/09/2026 · **Sostituisce in parte:** [ADR-0006](ADR-0006-hosting-italia.md) (la VPS a pagamento non è più il punto di partenza)

## Contesto
Il fondatore non può sostenere adesso il costo e la gestione di una VPS. Serve comunque, già da ottobre,
un indirizzo pubblico HTTPS stabile: l'app Android (TWA) verifica il dominio e i tester devono poterla aprire.
Dominio disponibile: **inspectio.cloud** (su Aruba). L'app vivrà su un sottodominio, es. `dintorni.inspectio.cloud`
(nome definitivo da scegliere).

Opzioni valutate (settembre 2026):
- **Oracle Cloud "Always Free"** (regione Milano): 0 €/mese, VM ARM 2 CPU / 12 GB (limiti dimezzati a giugno 2026).
  Contro: carta di credito per la verifica, regione scelta alla registrazione e non modificabile, spesso "capacità esaurita"
  per le VM ARM, le VM gratuite troppo inattive possono essere recuperate da Oracle (si evita passando a "Pay As You Go"
  restando nei limiti gratuiti, con avviso di spesa a 1 €).
- **Computer a casa + Cloudflare Tunnel**: nessun canone, nessuna porta aperta sul router, HTTPS automatico.
  Costo = corrente: vecchio portatile o mini PC ≈ 10-15 W → **2-3 €/mese**; PC fisso con scheda video acceso 24/7 → **10-20 €/mese**
  (quanto una VPS: sconsigliato per il 24/7).
- **VPS economica** (Hetzner ~4-5 €/mese, Aruba Cloud): la più semplice e stabile, ma a pagamento.

## Decisione
1. **Cloudflare Tunnel sempre** (piano gratuito): il server apre una connessione in uscita verso Cloudflare; nessuna porta
   aperta, HTTPS gestito da Cloudflare. Il server può così stare **ovunque** (casa, Oracle, VPS) e spostarlo non cambia nulla
   per gli utenti e per l'app Android: cambia solo dove gira il connettore `cloudflared`.
2. **Ottobre (anteprima e tester):** il computer di casa del fondatore, anche non acceso 24/7 (l'app mostra una pagina "offline").
3. **Dal lancio:** in ordine di preferenza
   a. Oracle Cloud Always Free a Milano, se si riesce a ottenere la VM;
   b. un vecchio portatile/mini PC sempre acceso a casa (2-3 €/mese di corrente);
   c. una VPS economica **solo quando arrivano le prime entrate** (crowdfunding).
4. **DNS:** i nameserver di `inspectio.cloud` passano da Aruba a Cloudflare (gratis, il dominio resta registrato su Aruba).
   ⚠️ Prima del cambio vanno copiati in Cloudflare i record esistenti (in particolare **MX/SPF della posta**, se il dominio ha caselle email).
5. **Nomi dei sottodomini:** un solo livello sotto il dominio (`dintorni.inspectio.cloud`, `dintorni-beta.inspectio.cloud`),
   **non** `beta.dintorni.inspectio.cloud`: il certificato gratuito di Cloudflare copre solo `*.inspectio.cloud`.
6. **Niente Caddy nello stack di produzione:** header di sicurezza impostati da Next.js (`next.config.ts`), limiti di frequenza
   nell'app e con la regola gratuita di Cloudflare. Stack: `cloudflared` + `app` + `worker` + `postgres`.
7. **Backup:** `restic` cifrato verso Cloudflare R2 (10 GB gratuiti) — i dati sono cifrati prima di uscire.
8. **Pacchetto Android:** `cloud.inspectio.<nome>` (dominio al contrario), deciso con il nome.

## Conseguenze
- ✅ Costo fisso di hosting: 0-3 €/mese.
- ✅ Migrazione futura su VPS = copia dei dati + nuovo `cloudflared`: nessun cambio di DNS né di app.
- ⚠️ **Privacy:** Cloudflare (USA, aderente all'EU-US Data Privacy Framework) vede il traffico in transito perché termina l'HTTPS:
  va indicato nell'informativa come responsabile del trattamento (R-PRIV-08). Il database resta in Italia (a casa o a Milano).
- ⚠️ **Macchina a casa:** disco cifrato obbligatorio (BitLocker/LUKS/FileVault), utente dedicato, aggiornamenti automatici,
  niente altri servizi esposti. Se va via la corrente o internet, il sito è giù: accettabile in anteprima, da evitare dopo il lancio.
- ⚠️ Processori ARM (Oracle, Raspberry Pi): le immagini Docker devono essere multi-architettura. Node e `cloudflared` lo sono.
  **Correzione del 27/09/2026 (verificato su Docker Hub):** `postgis/postgis` esiste **solo per amd64**. Per ARM si usa una piccola
  immagine nostra basata su `postgres:17` ufficiale (multi-architettura) + il pacchetto `postgresql-17-postgis-3` del repository
  ufficiale di PostgreSQL (WP-010).

## Verifica
WP-010: l'app risponde su `https://<nome>.inspectio.cloud` tramite tunnel; `assetlinks.json` raggiungibile; nessuna porta aperta
sulla macchina (verifica con una scansione esterna); ripristino da backup R2 provato.
