/**
 * Dati dell'ente che gestisce il servizio, obbligatori sul sito (R-LAV-04: art. 6 D.Lgs. 276/2003;
 * R-CONS-04: D.Lgs. 70/2003 art. 7). L'associazione è in costituzione: `null` = "in costituzione".
 * Si compilano qui (un solo posto) appena ci sono atto costitutivo, codice fiscale e PEC.
 */
export type Organization = {
  name: string | null;
  seat: string | null;
  taxCode: string | null;
  vatNumber: string | null;
  pec: string | null;
  legalRepresentative: string | null;
  contactEmail: string | null;
};

export const organization: Organization = {
  name: null,
  seat: null,
  taxCode: null,
  vatNumber: null,
  pec: null,
  legalRepresentative: null,
  contactEmail: null,
};

export const ORGANIZATION_FIELDS = [
  "name",
  "seat",
  "taxCode",
  "vatNumber",
  "pec",
  "legalRepresentative",
  "contactEmail",
] as const satisfies readonly (keyof Organization)[];
