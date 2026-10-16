# WP-010a — revisione di ChatGPT (Codex CLI, 01/10/2026)

> Prompt: `docs/prompts/chatgpt-revisione.md` sul diff del ramo del WP-010a. Risposta originale sotto; la gestione
> dell'architetto è in fondo.
>
> Nota: dopo la revisione il nome provvisorio è passato da "Tasky" a "Jobinetic" (marchio UE "Tasky" di terzi, vedi
> `docs/09-DOMANDE-APERTE.md` Q1).

## 1. Bloccanti

1. [SPRINT-1.md:214](../docs/work-packages/SPRINT-1.md:214) · L’elenco `**Codice:**` del WP-010a non comprende file modificati dal diff, tra cui `src/app/layout.tsx`, `.env.example`, `playwright.config.ts` e la rimozione di `favicon.ico`. · La regola del repository consente modifiche solo ai file elencati nel WP; così il perimetro non è verificabile. · **Patch minima:** aggiungere al WP-010a una riga con i file di integrazione, test e documentazione effettivamente toccati.

2. [pwa.spec.ts:93](../tests/e2e/pwa.spec.ts:93) · `assetlinks.json` è testato solo con entrambe le variabili presenti; manca il test del `404` senza configurazione, richiesto dal WP-010a. · I test verdi non coprono questo criterio di accettazione. · **Patch minima:** aggiungere un test della route con `getServerEnv` simulato senza le due variabili e verificare `GET().status === 404`; aggiungere anche il caso configurato solo a metà.

## 2. Importanti

1. [service-worker.ts:73](../src/lib/pwa/service-worker.ts:73) · Le pagine di ripiego funzionano solo per navigazioni tra documenti. I link Next.js usati nell’app effettuano navigazioni client e richieste RSC, che non hanno `mode: "navigate"`; i test usano invece `page.goto()`. · Un utente già dentro l’app potrebbe non vedere «Sei offline» o «Servizio non raggiungibile» toccando un link. Questa è un’inferenza dal codice e dal comportamento documentato di [Next.js Link](https://nextjs.org/docs/app/api-reference/components/link), delle [transizioni RSC](https://nextjs.org/docs/app/guides/prefetching) e di [`Request.mode`](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode). · **Patch minima:** aggiungere un e2e che, dopo l’attivazione del worker, tolga la rete e faccia clic su un link dell’app. Se il WP intende coprire solo i caricamenti completi, precisarlo nella specifica; se intende coprire anche questo flusso, serve una correzione concordata con l’architetto.

2. [env.ts:39](../src/lib/env.ts:39) · Pacchetto e impronte sono entrambi opzionali in modo indipendente. · Un deploy con una sola variabile supera la validazione d’avvio ma pubblica `404`, nascondendo una configurazione TWA incompleta. · **Patch minima:** aggiungere una validazione Zod a livello di oggetto che accetti *entrambe assenti* oppure *entrambe presenti*, con test dei due casi parziali.

3. [asset-links.ts:13](../src/lib/pwa/asset-links.ts:13) · `.filter(Boolean)` accetta `impronta,` e `impronta,,impronta` scartando le voci vuote. · Un errore nella configurazione passa inosservato. · **Patch minima:** togliere `.filter(Boolean)` e lasciare che la regex rifiuti le voci vuote; aggiungere due asserzioni al test del parser.

4. [.env.example:22](../.env.example:22) · Il nome del mittente resta configurato in `MAIL_FROM`: cambiare l’esempio non aggiorna un `.env.local` o un deploy già configurato con «HR». · Il criterio «nome Tasky … email» non è garantito dal diff. · **Patch minima:** prevedere nel WP-010a la verifica del valore effettivo di `MAIL_FROM` nel deploy; non cambiare implicitamente il contratto della variabile.

## 3. Semplificazioni

1. [messages/it.json:4](../messages/it.json:4) · «Tasky» compare sia in `meta.siteName` sia in `meta.title`, benché il WP dichiari un solo punto per il nome. · Una rinomina richiede due modifiche. · **Patch minima:** lasciare in `meta.title` solo «Il lavoro vicino a casa» e comporre `siteName + " — " + title` in [layout.tsx:18](../src/app/layout.tsx:18) e [manifest.ts:12](../src/app/manifest.ts:12).

## 4. Conformità

- ✅ Manifest, misure PNG dichiarate, icona maskable, registrazione del worker in produzione e formato del JSON Digital Asset Links: coperti dai test dichiarati. Il formato delle impronte e del target corrisponde alla [specifica Google](https://developers.google.com/digital-asset-links/v1/statements).
- ✅ Pagina offline, ripresa con «Riprova» e risposta 530: verificati **per caricamenti completi**.
- ❌ `404` senza configurazione Android: implementato, ma non testato.
- ❌ Comportamento offline durante la normale navigazione tramite link: non verificato.
- ⏳ Installazione TWA senza barra e test chiuso: criteri del WP-010 complessivo, previsti per 010d, fuori da questo diff.
- **Dipendenze aggiunte:** nessuna; non c’è un nuovo pacchetto npm da verificare.
- **Dati personali in log/errori/URL:** no, nel diff esaminato.
- **Stringhe UI fuori da `messages/it.json`:** no per le nuove pagine PWA. Il nome visibile del mittente email è però duplicato nella configurazione `MAIL_FROM`.
- `pnpm check` verde e 26 e2e superati sono risultati forniti dall’utente; non li ho rieseguiti. `git diff --cached --check` è pulito.

## 5. Verdetto

**DA CORREGGERE.** Passare al modello locale, nell’ordine:

1. Allineare l’elenco dei file del WP-010a al diff.
2. Testare il `404` di `assetlinks.json` senza configurazione e con configurazione parziale.
3. Rifiutare all’avvio la coppia Android incompleta e le voci vuote nell’elenco delle impronte.
4. Aggiungere il test offline con clic su un link e chiarire con Claude il comportamento richiesto per la navigazione client.
5. Eliminare la duplicazione di «Tasky» nel titolo e verificare il mittente email configurato.

### Proposte per l’architetto

Decidere se le due pagine del service worker debbano apparire anche durante le transizioni client di Next.js. Il WP-010a prescrive esplicitamente di intercettare solo le navigazioni GET: estendere quel comportamento richiede una scelta sul flusso dell’app, oltre al test.
---

## Gestione dell'architetto (Claude)

| # | Punto | Esito |
|---|-------|-------|
| B1 | Elenco dei file del WP-010a incompleto | ✅ Applicato: elenco completo in `SPRINT-1.md`. |
| B2 | 404 di `assetlinks.json` senza configurazione non testato | ✅ Applicato: `androidAssetLinks()` (pura) con test dei casi vuoto e a metà; la route la usa. |
| I1 | Pagine offline nelle navigazioni interne di Next.js | ✅ Verificato con 2 nuovi e2e (link toccato senza rete e con 530): funzionano già, perché Next.js, quando la richiesta RSC fallisce, ripiega su una navigazione completa che passa dal service worker. Nessuna modifica al codice. |
| I2 | Configurazione Android a metà accettata all'avvio | ✅ Applicato: `refine` sull'oggetto in `env.ts` (tutte e due o nessuna), con test. |
| I3 | `.filter(Boolean)` accetta voci vuote | ✅ Applicato: tolto, con due asserzioni in più. |
| I4 | `MAIL_FROM` non garantisce il nome nelle email | ✅ Documentato: il mittente è configurazione; in produzione si imposta nel WP-010c. Oggetto e firma delle email usano già `meta.siteName`. |
| S1 | "Tasky" ripetuto in `meta.title` | ✅ Applicato: `meta.title` = `{siteName} — Il lavoro vicino a casa`, composto in `layout.tsx` e `manifest.ts`. |

Verdetto finale: **approvato** dopo le correzioni. `pnpm check` verde (233 test unitari), 30 e2e verdi (pwa, security, home) su mobile e desktop.
