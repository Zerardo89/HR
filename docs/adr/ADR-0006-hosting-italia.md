# ADR-0006 — Hosting su VPS in Italia con Docker Compose e Caddy

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Dominio già su Aruba. Budget ridotto. Dati personali: preferenza per Italia/UE (niente trasferimenti extra-UE).
Serve un indirizzo pubblico HTTPS già dalla settimana 1 (TWA + tester).

## Decisione
- **Un VPS Aruba Cloud** (datacenter in Italia), minimo **4 GB RAM / 2 vCPU / 80 GB SSD**, Ubuntu LTS.
- **Docker Compose** con servizi: `caddy`, `app`, `worker`, `postgres` (rete interna), `umami`, `uptime-kuma`, `backup` (restic in cron).
- **Caddy** per HTTPS automatico (Let's Encrypt), header di sicurezza, compressione, rate limit base.
- DNS nel pannello Aruba: sottodomini → IP del VPS.
- **Backup offsite** cifrati su object storage di **un altro fornitore UE** (regola 3-2-1; un incendio in un datacenter non deve cancellare tutto).
- Email transazionali via **Brevo** (azienda UE), DPA firmato.
- Staging e produzione sullo stesso VPS all'inizio (compose separati, DB separati); separazione su due VPS quando il traffico lo richiede.

## Alternative scartate
- **Server a casa**: IP dinamico/CGNAT, rischio per la rete domestica, uptime scarso, revisione Play inaffidabile.
- **Vercel + DB gestito**: comodo ma dati e log su infrastrutture USA, costi imprevedibili con traffico e cron.
- **Kubernetes**: sproporzionato.
- **Hetzner**: ottimo rapporto prezzo/prestazioni (Germania, UE) — alternativa valida se Aruba non soddisfa; si perde il "dati in Italia".

## Conseguenze
- ✅ "I tuoi dati restano in Italia" è un messaggio vero e forte.
- ⚠️ Gestione server a nostro carico: aggiornamenti automatici, monitoraggio, runbook di ripristino.

## Verifica
Runbook `docs/runbook/` (da scrivere in settimana 4): deploy, rollback, ripristino da backup cronometrato (< 2 ore).
