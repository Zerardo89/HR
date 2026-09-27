import it from "../../messages/it.json";

/**
 * Testi fuori da React (email, job del worker). Stesso file `messages/it.json` dell'interfaccia:
 * nessuna stringa cablata nel codice. I segnaposto sono `{nome}`, come in next-intl.
 */
export const messages = it;

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
