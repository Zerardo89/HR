/** Nome di un comune per i confronti: minuscole, senza accenti né apostrofi, spazi singoli ("Reggio nell'Emilia" → "reggio nell emilia"). */
export function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Castro (LE)" → nome e sigla della provincia; "Milano" → solo il nome. */
export function parsePlaceText(value: string): { name: string; provinceAbbr?: string } {
  const m = /^(.*?)\s*\(\s*([A-Za-z]{2})\s*\)\s*$/.exec(value);
  return m && m[1]
    ? { name: m[1].trim(), provinceAbbr: m[2]!.toUpperCase() }
    : { name: value.trim() };
}
