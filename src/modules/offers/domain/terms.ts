/**
 * Termini vietati o sospetti negli annunci (WP-012). Tabella di dati, non logica: la lista si allunga
 * (anche con la proposta di Gemini, roadmap 06/10) senza toccare il validatore.
 *
 * Il testo viene prima normalizzato: minuscole, niente accenti, punteggiatura → spazio singolo
 * (es. "Età max: 30 anni!" → "eta max 30 anni"). I pattern lavorano su quel testo.
 *
 * - `error`  → l'azienda deve correggere prima di pubblicare;
 * - `review` → si può inviare, ma l'offerta passa in moderazione (un moderatore decide; vede solo l'offerta).
 */
export type Severity = "error" | "review";

export type TermRule = {
  code: string;
  rule: string; // ID della regola in docs/02-REGOLE-DEL-GIOCO.md
  severity: Severity;
  pattern: RegExp;
};

const AGE = String.raw`(?:19|[2-6]\d)`; // limiti di età sopra i 18 (la maggiore età è già un requisito)
const ANY_AGE = String.raw`(?:1[6-9]|[2-6]\d)`;

export const TERM_RULES: readonly TermRule[] = [
  // R-ANN-04 — età: vietata (in apprendistato l'età è un requisito di legge: il validatore la manda in moderazione)
  {
    code: "age_limit",
    rule: "R-ANN-04",
    severity: "error",
    pattern: new RegExp(
      [
        String.raw`\b(?:max|massimo|massima|entro i|fino ai?|non oltre i?|sotto i)\s?${AGE}\s?anni\b(?!\sdi\sesperienza)`,
        String.raw`\bunder\s?${AGE}\b`,
        String.raw`\btra i\s?${ANY_AGE}\s(?:e|ai?)\s(?:i\s)?${AGE}\s?anni\b`,
        String.raw`\b${ANY_AGE}\s(?:a\s)?${AGE}\sanni\b`,
        String.raw`\b(?:eta|anni) (?:massima|compresa|non superiore)(?:\s(?:a\s|di\s|tra\s(?:i\s)?)?${ANY_AGE}(?:\s(?:e|a)\s(?:i\s)?${AGE})?(?:\sanni)?)?\b`,
      ].join("|"),
    ),
  },
  // "età", "giovane", "over 50" (le assunzioni agevolate sono lecite): decide il moderatore
  {
    code: "age_mention",
    rule: "R-ANN-04",
    severity: "review",
    pattern: new RegExp(String.raw`\beta\b|\bgiovan[eiao]\b|\bover\s?${AGE}\b`),
  },
  // R-ANN-04 — origine e nazionalità
  {
    code: "nationality",
    rule: "R-ANN-04",
    severity: "error",
    pattern:
      /\b(?:solo|soltanto|esclusivamente) (?:italian[ieoa]|cittadini italiani)\b|\bno (?:stranier[ie]|extracomunitari)\b|\b(?:nazionalita|cittadinanza) italiana\b|\bitalian[oa] di nascita\b/,
  },
  { code: "native_speaker", rule: "R-ANN-04", severity: "error", pattern: /\bmadre ?lingua\b/ },
  // R-ANN-04 — aspetto e mezzi propri (ammessi solo se motivati: moderazione)
  {
    code: "appearance",
    rule: "R-ANN-04",
    severity: "review",
    pattern: /\bbella presenza\b|\bpresenza curata\b|\baltezza minima\b/,
  },
  { code: "own_car", rule: "R-ANN-04", severity: "review", pattern: /\bautomunit[oaie]\b/ },
  // R-ANN-03 — un solo sesso (ammesso solo per un requisito essenziale motivato: moderazione)
  {
    code: "gender",
    rule: "R-ANN-03",
    severity: "review",
    pattern:
      /\b(?:solo|soltanto|esclusivamente) (?:uomini|donne|ragazz[eiao]|maschi|femmine)\b|\bcercasi ragazz[aoie]\b|\bcerchiamo (?:una |un )?ragazz[aoie]\b|\bsignorin[ae]\b/,
  },
  // R-LAV-05 — dati non pertinenti alle attitudini professionali
  {
    code: "irrelevant_personal_data",
    rule: "R-LAV-05",
    severity: "error",
    pattern:
      /\b(?:cv|curriculum) con foto\b|\ballegare (?:una )?foto\b|\bstato civile\b|\b(?:senza|con) figli\b|\bnubile\b|\bcelibe\b|\bsposat[aoie]\b|\bgravidanza\b/,
  },
  // R-ANN-02 — storico retributivo
  {
    code: "salary_history",
    rule: "R-ANN-02",
    severity: "error",
    pattern:
      /\b(?:ral|retribuzione|stipendio|compenso) (?:attuale|precedente|percepit[oa]|corrente)\b|\bultim[oa] (?:stipendio|retribuzione|busta paga|ral)\b|\bquanto guadagni\b|\bbusta paga attuale\b/,
  },
  // R-LAV-11 — soldi chiesti ai candidati
  {
    code: "payment_request",
    rule: "R-LAV-11",
    severity: "review",
    pattern:
      /\bquota (?:di )?(?:iscrizione|adesione|ingresso)\b|\binvestimento iniziale\b|\bkit (?:a pagamento|di avvio|iniziale)\b|\bcorso (?:obbligatorio )?a pagamento\b|\b(?:anticipo|contributo) spese\b|\bversamento (?:iniziale|anticipato|di una (?:quota|somma))\b|\bdeposito cauzionale\b/,
  },
  // §3.2 anti-truffa — contatti fuori piattaforma e dati sensibili in fase di candidatura
  {
    code: "off_platform_contact",
    rule: "R-ANN-08",
    severity: "review",
    pattern:
      /\bwhats ?app\b|\btelegram\b|\b(?:\+?39 ?)?3\d{2} ?\d{3} ?\d{3,4}\b|\b0\d{1,3} ?\d{5,8}\b/,
  },
  {
    code: "sensitive_request",
    rule: "R-ANN-08",
    severity: "review",
    pattern:
      /\biban\b|\bcarta di credito\b|\bdati bancari\b|\b(?:copia|foto) (?:del |della )?(?:documento|carta d identita|passaporto|codice fiscale)\b/,
  },
];
