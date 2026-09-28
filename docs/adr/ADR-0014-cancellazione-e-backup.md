# ADR-0014 — Cancellazione dell'account: crypto-shredding subito, backup entro la rotazione

**Stato:** Accettata · **Data:** 28/09/2026 · **Precisa:** ADR-0004 ("diritto all'oblio anche nei backup")

## Contesto
ADR-0004 e docs/04 §3 dicevano che distruggendo la DEK i dati diventano illeggibili "anche nei backup". Scrivendo la
cancellazione (WP-023) è emerso che non è vero **subito**: la DEK è salvata nel database cifrata con la KEK
(`users.dek_wrapped`), quindi un backup fatto **prima** della cancellazione contiene ancora la DEK cifrata; finché
esiste la KEK, da quel backup i dati si possono ancora decifrare. Una promessa sulla privacy deve essere esatta
(CLAUDE.md, docs/04 §1).

## Decisione
- **Nel sistema, subito:** la cancellazione distrugge la DEK (`dek_wrapped = null`), cancella profilo, candidature,
  avvisi, sessioni e token, libera l'indice cieco dell'email; resta una "lapide" senza dati personali (id, stato
  `deleted`, data) e i consensi come prova. Tutto in una transazione, con audit `account.delete`.
- **Nei backup, entro la rotazione:** i backup cifrati (restic, fuori sede) si conservano al più ~6 mesi
  (7 giornalieri, 4 settimanali, 6 mensili: docs/04 §6). Scaduto l'ultimo backup che conteneva la DEK, i dati sono
  illeggibili ovunque. Nel frattempo i backup non si consultano (nessun accesso nel lavoro normale, docs/04 §5).
- **Dopo un ripristino da backup** (runbook, WP-030): si ripetono le cancellazioni avvenute dopo la data del backup.
  Per questo ogni cancellazione scrive nel log applicativo (conservato fuori dal DB) l'evento `account.erased` con
  il solo id dell'utente (pseudonimo, nessun dato personale, R-PRIV-05).
- Testo per gli utenti: "i tuoi dati diventano subito illeggibili; nelle copie di sicurezza cifrate spariscono con
  la loro rotazione, al più entro 6 mesi".

## Alternative scartate
- **DEK fuori dal database** (archivio di chiavi separato, non incluso nei backup): shredding immediato anche nei
  backup, ma perdere l'archivio delle chiavi = perdere tutti i dati, e il backup delle chiavi riporta lo stesso
  problema. Da rivalutare con OpenBao (Fase 2, docs/04 §4): il motore Transit può tenere chiavi per utente.
- **Riscrivere i backup** a ogni cancellazione: impossibile con backup immutabili e fuori sede (e non desiderabile).

## Conseguenze
- ✅ Promessa esatta e verificabile; diritto all'oblio rispettato nei tempi dichiarati.
- ⚠️ Il runbook di ripristino deve ripetere le cancellazioni successive al backup (voce obbligatoria in WP-030).

## Verifica
Test di integrazione: dopo la cancellazione `dek_wrapped` è nullo, i dati C2 non si decifrano, le righe collegate
non esistono più, l'email si può registrare di nuovo, restano solo lapide, consensi e audit.
