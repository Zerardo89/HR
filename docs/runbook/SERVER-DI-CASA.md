# Guida — accendere il sito sul server di casa

> WP-010c · ADR-0012 (Cloudflare Tunnel, nessuna porta aperta) · ADR-0014 (backup). Per il fondatore, con Claude
> accanto la prima volta. Tempo: circa 2 ore. Tutto gira in contenitori Docker: funziona su processori Intel/AMD e
> ARM. Nessun passo mostra dati personali.

**Come è fatto.** Sul server girano cinque contenitori (`docker-compose.prod.yml`): il **database** (Postgres +
PostGIS), una **preparazione** che a ogni avvio aggiorna le tabelle e poi si ferma, il **sito**, i **lavori
automatici** (worker) e **cloudflared**, il collegamento sicuro con Cloudflare. Il router di casa resta chiuso: è il
server che chiama Cloudflare, non il contrario. Password e chiavi stanno solo nella cartella `secrets` del server.

## 0. Cosa serve prima

| Cosa | Dove | Note |
|------|------|------|
| Il server | a casa, sempre acceso, collegato via cavo | Consigliato **Ubuntu Server 24.04 LTS** (gratuito). All'installazione scegli **disco cifrato** (LUKS). Con Windows si può usare Docker Desktop, ma per un server sempre acceso Ubuntu è più adatto. |
| Account **Cloudflare** | cloudflare.com, piano gratuito | Il dominio `inspectio.cloud` deve usare i nameserver di Cloudflare. ⚠️ Prima del cambio copia in Cloudflare i record **MX** e **TXT** della posta, se il dominio ha caselle email su Aruba. |
| Account **Brevo** | brevo.com, piano gratuito | Per le email (codici di accesso, avvisi). Autentica il dominio (SPF, DKIM, DMARC) seguendo Brevo: i record si aggiungono in Cloudflare. |
| **Cloudflare R2** | nel pannello Cloudflare → R2 | Backup cifrati fuori casa, gratis fino a 10 GB (può chiedere una carta per attivarlo). Crea un bucket, es. `backup-sito`, con **giurisdizione Unione Europea**, e un token API "lettura e scrittura" solo per quel bucket. |
| Accesso al repository | GitHub | Il repository è privato: sul server serve un token di accesso in sola lettura (GitHub → Settings → Developer settings → Fine-grained tokens, solo `Zerardo89/HR`, permesso "Contents: read"). |

## 1. Preparare il server (una volta)

```sh
sudo timedatectl set-timezone Europe/Rome          # i job e i backup usano l'ora italiana
sudo apt update && sudo apt install -y git unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades    # aggiornamenti di sicurezza automatici: rispondi "Sì"
```

Installa Docker seguendo la guida ufficiale (sezione "Install using the apt repository"):
<https://docs.docker.com/engine/install/ubuntu/>. Poi:

```sh
sudo git clone https://github.com/Zerardo89/HR.git /srv/hr   # come password usa il token di GitHub
sudo chown -R "$USER": /srv/hr
cd /srv/hr
```

**Comandi da amministratore.** Chi comanda Docker comanda tutto il server: per questo i comandi `docker` di questa
guida iniziano con `sudo` (ti chiede la password) e il tuo utente **non** va aggiunto al gruppo `docker`. Il server
serve solo al sito: niente navigazione, giochi o altri programmi (docs/04 §4-bis).

## 2. Configurazione (niente password qui)

```sh
cp .env.production.example .env.production
nano .env.production
```

Da completare: `APP_URL` (l'indirizzo con il nome scelto), `SMTP_USER` (login SMTP di Brevo), `MAIL_FROM`,
`RESTIC_REPOSITORY` (indirizzo del bucket R2). `PREVIEW_INVITE_CODES` lo completi al passo 3.

## 3. Costruire i contenitori e creare i segreti

```sh
sudo docker compose -f docker-compose.prod.yml build         # 5-15 minuti la prima volta
mkdir -p secrets
sudo docker run --rm --user root -v "$PWD/secrets:/app/secrets" --entrypoint node_modules/.bin/tsx hr-tools scripts/generate-server-secrets.ts
sudo docker run --rm --user root -v "$PWD/secrets:/app/secrets" --entrypoint node_modules/.bin/tsx hr-tools scripts/generate-keys.ts
sudo docker run --rm --entrypoint node_modules/.bin/tsx hr-tools scripts/preview-invite-code.ts   # → in .env.production
```

Poi incolla i quattro segreti dei servizi esterni, uno per file (`nano secrets/<nome>`, incolla, salva con Ctrl+O,
esci con Ctrl+X):

| File | Cosa incollare |
|------|----------------|
| `secrets/cloudflared_token` | il token del tunnel (passo 4) |
| `secrets/smtp_password` | la chiave SMTP di Brevo (Brevo → SMTP & API) |
| `secrets/r2_access_key_id` | "Access Key ID" del token R2 |
| `secrets/r2_secret_access_key` | "Secret Access Key" del token R2 |

Infine i permessi (la cartella la apre solo il tuo utente; i contenitori leggono i file):

```sh
sudo chown -R "$USER": secrets && chmod 700 secrets && chmod 444 secrets/*
```

⚠️ **Copie di sicurezza da fare subito**, fuori dal server: `secrets/kek.b64` e `secrets/blind-index.b64` al
**custode delle chiavi** (docs/04 §4; senza KEK i dati personali sono persi per sempre) e `secrets/restic_password`
nel tuo gestore di password (senza, i backup sono illeggibili).

## 4. Il tunnel di Cloudflare

1. Pannello Cloudflare → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → tipo **Cloudflared** →
   nome `server-casa`.
2. Nella pagina successiva Cloudflare mostra un comando con `--token eyJ…`: copia **solo** il testo lungo dopo
   `--token` in `secrets/cloudflared_token`. Non serve installare nulla: cloudflared è già tra i contenitori.
3. **Public hostname**: sottodominio = il nome dell'app (es. `jobinetic`), dominio `inspectio.cloud`,
   servizio **HTTP**, URL **`app:3000`**.
4. In Cloudflare → il dominio → **SSL/TLS** → **Edge Certificates**: attiva **Always Use HTTPS**.
5. Facoltativo ma consigliato (regola gratuita): **Security** → **WAF** → **Rate limiting rules**, una regola sulle
   richieste a `/accedi` (es. 20 ogni 10 secondi per IP → blocco per 10 secondi).

## 5. Accendere

```sh
sudo docker compose -f docker-compose.prod.yml up -d
sudo docker compose -f docker-compose.prod.yml ps      # db e app "healthy", worker e cloudflared "Up", migrate "Exited (0)"
```

Apri `https://<nome>.inspectio.cloud`: deve comparire il sito con la striscia "Anteprima".
Prima volta soltanto, carica le mansioni e prepara l'archivio dei backup:

```sh
sudo docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/taxonomy-import.ts
sudo docker compose -f docker-compose.prod.yml --profile ops run --rm backup restic init
```

**Amministratore:** registrati dal sito (in anteprima serve il codice invito), poi lancia questo comando così
com'è e, quando compare `Email:`, scrivi la tua email e premi Invio (scritta lì non resta nella cronologia dei comandi):

```sh
sudo docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/users-role.ts - admin
```

**Comuni ISTAT** (quando ci sono, `data/README.md`): metti `data/municipalities.csv` nella cartella `data` e

```sh
sudo docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/geo-import.ts data/municipalities.csv
```

## 6. Backup automatici

Due backup, nella pianificazione dell'amministratore (`sudo crontab -e`, poi aggiungi le due righe):
- **ogni notte alle 01:30** il database e il registro delle cancellazioni (mai tra le 2 e le 3: cambio dell'ora);
- **ogni ora** il solo registro delle cancellazioni: se il server si rompe, un account cancellato non deve
  ricomparire dal backup della notte prima (ADR-0014).

```cron
30 1 * * * cd /srv/hr && docker compose -f docker-compose.prod.yml --profile ops run --rm backup >> /var/log/backup-sito.log 2>&1
5 * * * * cd /srv/hr && docker compose -f docker-compose.prod.yml --profile ops run --rm backup bash /backup-registro.sh >> /var/log/backup-sito.log 2>&1
```

Ogni mese: **prova di ripristino** (docs/runbook/BACKUP-E-RIPRISTINO.md §4, i comandi per i contenitori sono al
§9 qui sotto) e annota l'esito.

## 7. Aggiornare il sito (a ogni nuova versione su `main`)

```sh
cd /srv/hr && git pull
sudo docker compose -f docker-compose.prod.yml pull cloudflared      # nuova versione del tunnel, se c'è
sudo APP_VERSION=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml build --pull
sudo docker compose -f docker-compose.prod.yml up -d
```

`build --pull` scarica anche gli aggiornamenti di sicurezza di Node e Postgres. La preparazione aggiorna le tabelle
da sola prima che il sito riparta. Il numero di versione si vede in `https://<nome>.inspectio.cloud/api/health`.
Anche senza versioni nuove del sito, **una volta al mese** fai questi tre comandi: tengono aggiornate le immagini.

## 8. Se qualcosa non va

| Cosa vedi | Cosa fare |
|-----------|-----------|
| "Servizio non raggiungibile" nell'app | Il server è spento o senza internet, oppure cloudflared è fermo: `sudo docker compose -f docker-compose.prod.yml ps`. |
| Un contenitore riparte di continuo | `sudo docker compose -f docker-compose.prod.yml logs --tail 50 <nome>` (app, worker, migrate, cloudflared). I log non contengono dati personali. |
| "Configurazione non valida: …" nei log del sito | Manca o è sbagliata la variabile indicata in `.env.production` (es. `PREVIEW_INVITE_CODES` in anteprima). |
| Le email non arrivano | Controlla `SMTP_USER`, `secrets/smtp_password` e l'autenticazione del dominio in Brevo. |

## 9. Cambiare macchina o ripristinare dopo un guasto (ADR-0012, ADR-0014)

Non è una prima installazione: **non** si creano segreti nuovi (con una KEK nuova i dati del backup sarebbero
illeggibili). La prima volta fallo insieme a Claude; la prova di ripristino mensile serve proprio a esercitarsi.

1. Sulla nuova macchina: passo 1. Poi copia nella cartella `/srv/hr` la cartella `secrets` **di prima** (dalla copia
   di sicurezza: KEK dal custode delle chiavi) e il file `.env.production` di prima. Salta i passi 2 e 3, tranne
   `sudo docker compose -f docker-compose.prod.yml build`. Rifai i permessi della cartella `secrets` (fine passo 3).
2. Accendi solo il database:
   `sudo docker compose -f docker-compose.prod.yml up -d db`
3. Ripristina l'ultimo backup del database dentro il contenitore del backup (restic e pg_restore sono lì):

   ```sh
   sudo docker compose -f docker-compose.prod.yml --profile ops run --rm backup bash -c \
     'restic restore latest --tag db --target /tmp/r --quiet && pg_restore --no-owner --no-privileges -d "$DATABASE_URL" /tmp/r/hr-db-*.dump'
   ```

4. Ripeti le cancellazioni avvenute dopo quel backup, con il registro più recente (contiene solo codici, nessun dato
   personale):

   ```sh
   sudo docker compose -f docker-compose.prod.yml --profile ops run --rm -T backup restic dump latest --tag registro /var/lib/hr/cancellazioni.jsonl > registro.jsonl
   sudo docker compose -f docker-compose.prod.yml --profile ops run --rm -v "$PWD/registro.jsonl:/tmp/registro.jsonl:ro" tools node_modules/.bin/tsx scripts/reapply-erasures.ts /tmp/registro.jsonl
   rm registro.jsonl
   ```

5. Accendi tutto: `sudo docker compose -f docker-compose.prod.yml up -d` (la preparazione aggiorna tabelle e ruoli).
6. Sulla vecchia macchina, se funziona ancora: `sudo docker compose -f docker-compose.prod.yml down`.

Il token del tunnel è lo stesso: indirizzo del sito e app Android non cambiano.
