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
| **Cloudflare R2** | nel pannello Cloudflare → R2 | Backup cifrati fuori casa, gratis fino a 10 GB (può chiedere una carta per attivarlo). Crea un bucket, es. `backup-sito`, e un token API "lettura e scrittura" solo per quel bucket. |
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
sudo usermod -aG docker "$USER"     # esci e rientra perché valga
sudo git clone https://github.com/Zerardo89/HR.git /srv/hr   # come password usa il token di GitHub
sudo chown -R "$USER": /srv/hr
cd /srv/hr
```

## 2. Configurazione (niente password qui)

```sh
cp .env.production.example .env.production
nano .env.production
```

Da completare: `APP_URL` (l'indirizzo con il nome scelto), `SMTP_USER` (login SMTP di Brevo), `MAIL_FROM`,
`RESTIC_REPOSITORY` (indirizzo del bucket R2). `PREVIEW_INVITE_CODES` lo completi al passo 3.

## 3. Costruire i contenitori e creare i segreti

```sh
docker compose -f docker-compose.prod.yml build         # 5-15 minuti la prima volta
mkdir -p secrets
docker run --rm --user root -v "$PWD/secrets:/app/secrets" --entrypoint node_modules/.bin/tsx hr-tools scripts/generate-server-secrets.ts
docker run --rm --user root -v "$PWD/secrets:/app/secrets" --entrypoint node_modules/.bin/tsx hr-tools scripts/generate-keys.ts
docker run --rm --entrypoint node_modules/.bin/tsx hr-tools scripts/preview-invite-code.ts   # → in .env.production
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
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps      # db e app "healthy", worker e cloudflared "Up", migrate "Exited (0)"
```

Apri `https://<nome>.inspectio.cloud`: deve comparire il sito con la striscia "Anteprima".
Prima volta soltanto, carica le mansioni e prepara l'archivio dei backup:

```sh
docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/taxonomy-import.ts
docker compose -f docker-compose.prod.yml --profile ops run --rm backup restic init
```

**Amministratore:** registrati dal sito (in anteprima serve il codice invito), poi:

```sh
docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/users-role.ts la-tua@email.it admin
```

**Comuni ISTAT** (quando ci sono, `data/README.md`): metti `data/municipalities.csv` nella cartella `data` e

```sh
docker compose -f docker-compose.prod.yml --profile ops run --rm tools node_modules/.bin/tsx scripts/geo-import.ts data/municipalities.csv
```

## 6. Backup automatici

Ogni notte alle 01:30 (mai tra le 2 e le 3: cambio dell'ora). `crontab -e` e aggiungi:

```cron
30 1 * * * cd /srv/hr && docker compose -f docker-compose.prod.yml --profile ops run --rm backup >> "$HOME/backup-sito.log" 2>&1
```

Ogni mese: **prova di ripristino** (docs/runbook/BACKUP-E-RIPRISTINO.md §4) e annota l'esito.

## 7. Aggiornare il sito (a ogni nuova versione su `main`)

```sh
cd /srv/hr && git pull
APP_VERSION=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build
```

La preparazione aggiorna le tabelle da sola prima che il sito riparta. Il numero di versione si vede in
`https://<nome>.inspectio.cloud/api/health`.

## 8. Se qualcosa non va

| Cosa vedi | Cosa fare |
|-----------|-----------|
| "Servizio non raggiungibile" nell'app | Il server è spento o senza internet, oppure cloudflared è fermo: `docker compose -f docker-compose.prod.yml ps`. |
| Un contenitore riparte di continuo | `docker compose -f docker-compose.prod.yml logs --tail 50 <nome>` (app, worker, migrate, cloudflared). I log non contengono dati personali. |
| "Configurazione non valida: …" nei log del sito | Manca o è sbagliata la variabile indicata in `.env.production` (es. `PREVIEW_INVITE_CODES` in anteprima). |
| Le email non arrivano | Controlla `SMTP_USER`, `secrets/smtp_password` e l'autenticazione del dominio in Brevo. |

## 9. Cambiare macchina (ADR-0012)

Sulla nuova macchina: passi 1-3 con **gli stessi file** di `secrets` (KEK compresa) e lo stesso `.env.production`;
ripristino dell'ultimo backup (BACKUP-E-RIPRISTINO.md §5); poi `up -d`. Il token del tunnel è lo stesso: indirizzo e
app Android non cambiano. Sulla vecchia macchina: `docker compose -f docker-compose.prod.yml down`.
