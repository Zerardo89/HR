# WP-010b — revisione di ChatGPT (Codex CLI, 01/10/2026)

> Seconda lettura del modulo di accesso (ADR-0013): prompt `docs/prompts/chatgpt-revisione.md` sul commit del WP-010b.
> Risposta originale sotto; la gestione dell'architetto è in fondo.

## 1. Bloccanti

- [actions.ts](../src/modules/identity/server/actions.ts:154) · Se `clientIp()` restituisce `null`, ogni tentativo sul codice invito salta il limite per IP. Inoltre, in produzione il default `x-forwarded-for` resta accettato anche se il deploy previsto usa Cloudflare Tunnel: un’intestazione non affidabile renderebbe aggirabile il limite. È grave perché il WP promette che i tentativi vengano contati. **Patch minima:** usare una chiave comune per gli IP mancanti (`ip ?? "__missing_ip__"`) prima di `codeChecks.hit`; in [env.ts](../src/lib/env.ts:72), rifiutare `PREVIEW_MODE=true` con `NODE_ENV=production` se `CLIENT_IP_HEADER` non è `cf-connecting-ip`. Aggiungere un test che verifichi il blocco dopo 30 tentativi e il caso senza intestazione IP.

## 2. Importanti

- [inputs.ts](../src/modules/identity/domain/inputs.ts:15) e [sign-in-flow.tsx](../src/modules/identity/ui/sign-in-flow.tsx:149) · Il limite di 64 caratteri conta anche spazi e trattini, mentre la configurazione ammette 64 caratteri *dopo* la normalizzazione. Un codice valido lungo 64 caratteri diventa quindi inutilizzabile se formattato. **Patch minima:** alzare entrambi i limiti dell’input a 128 e verificare nello schema che `normalizeInviteCode(value).length <= 64`.

- [preview-invite.test.ts](../tests/integration/preview-invite.test.ts:90) · I cinque test chiamano direttamente `completeSignup`: provano il vincolo nel servizio, ma non il limite applicato dalla Server Action. **Patch minima:** aggiungere un test della `signInAction` con intestazioni e cookie simulati che verifichi la risposta `rate_limited` e che il biglietto resti utilizzabile. La documentazione dichiara inoltre tre test di configurazione, mentre in [env.test.ts](../src/lib/env.test.ts:48) sono stati aggiunti due casi `it`.

## 3. Semplificazioni

Nessuna che riduca chiaramente la complessità senza indebolire i controlli.

## 4. Conformità

- **Criteri di accettazione:** ✅ controllo nel servizio prima del consumo del biglietto; ✅ accesso degli account esistenti invariato; ✅ normalizzazione e confronto degli hash con `timingSafeEqual` su tutti i codici; ✅ avviso e campo nella registrazione; ✅ validazione dei codici all’avvio tramite `instrumentation.ts`; ❌ limite per IP garantito anche senza intestazione; ❌ test del limite della Server Action. I 241 test, i cinque test di integrazione e i 32 e2e verdi sono risultati comunicati dall’utente, non rieseguiti in questa revisione.
- **Dipendenze aggiunte:** nessuna. Il nuovo comando usa `tsx` già presente nel lockfile; il pacchetto esiste su npm ed è mantenuto, con release `4.23.15` del 20 settembre 2026. [npm](https://www.npmjs.com/package/tsx), [release](https://github.com/privatenumber/tsx/releases).
- **Dati personali in log/errori/URL:** no, nel diff esaminato. Il codice invito non compare nelle scritture DB o nei messaggi d’errore esaminati; lo script di generazione lo stampa intenzionalmente sul terminale.
- **Stringhe UI fuori da `messages/it.json`:** no.

## 5. Verdetto

**DA CORREGGERE.** Correzioni da passare al modello locale:

1. Chiudere l’aggiramento del limite per IP e imporre l’intestazione affidabile nel deploy di anteprima.
2. Testare il limite attraverso la Server Action, incluso il caso senza IP.
3. Allineare la lunghezza ammessa nel modulo alla normalizzazione dei codici.
4. Correggere il conteggio dei test di configurazione nella specifica, oppure aggiungere il terzo caso dichiarato.

Le modifiche a `identity/server/**` spettano all’architetto secondo `CLAUDE.md`: il modello locale può preparare la correzione, ma Claude deve applicarla o validarla.


---

## Gestione dell'architetto (Claude)

| # | Punto | Esito |
|---|-------|-------|
| B1 | Senza IP i tentativi sul codice invito non si contano; `x-forwarded-for` falsificabile | ✅ Applicato in parte: `inviteAttemptAllowed()` mette i tentativi senza IP in un conteggio comune. Non obbligo `cf-connecting-ip` all'avvio: dietro un altro proxy (piano B, ADR-0006) `x-forwarded-for` è giusto; il valore per il server di casa è in `.env.production.example` e nella guida. Rischio reale basso comunque: i codici generati hanno ~60 bit. |
| I1 | Limite di 64 caratteri dell'input prima della normalizzazione | ✅ Applicato: 128 nello schema e nel campo, con test di un codice da 64 scritto a gruppi. |
| I2 | Il limite della Server Action non è testato | ✅ Applicato: il limite è in una funzione del dominio, testata (30 tentativi, IP diversi, finestra di 15 minuti, IP mancante). Non simulo `headers()`/`cookies()` di Next.js in un test dell'azione: la logica sta tutta nella funzione. |
| I3 | Conteggio dei test di configurazione nella specifica | ✅ Corretto (2). |

Verdetto finale: **approvato** dopo le correzioni.
