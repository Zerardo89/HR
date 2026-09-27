/**
 * Partita IVA italiana: 11 cifre, l'ultima è una cifra di controllo (algoritmo di Luhn, variante dell'Agenzia
 * delle Entrate). Il controllo locale scarta subito gli errori di battitura, prima di chiedere a VIES.
 */
export function normalizeVat(input: string): string {
  return input.replace(/[\s.-]/g, "").replace(/^it/i, "");
}

export function isValidItalianVat(vat: string): boolean {
  if (!/^\d{11}$/.test(vat) || /^0{11}$/.test(vat)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(vat[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(vat[10]);
}
