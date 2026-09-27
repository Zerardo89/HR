import type { SalaryPeriod } from "./validator";

/** Traduttore dei testi `publicOffer` (next-intl): serve solo la firma. */
export type SalaryTranslator = (key: string, values?: Record<string, string>) => string;

export type SalaryFields = {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  salaryBasis: "gross" | "net";
};

const euroFormat = (digits: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
  });
const euroWhole = euroFormat(0);
const euroCents = euroFormat(2);

export function formatEuro(value: number): string {
  return (Number.isInteger(value) ? euroWhole : euroCents).format(value);
}

/** "Da 1600 € a 1800 € lordi al mese" / "9,50 € lordi all'ora" (R-ANN-01: lo stipendio si vede sempre). */
export function formatSalary(o: SalaryFields, t: SalaryTranslator): string | null {
  if (o.salaryMin == null || !o.salaryPeriod) return null;
  const amount =
    o.salaryMax != null && o.salaryMax !== o.salaryMin
      ? t("salaryRange", { min: formatEuro(o.salaryMin), max: formatEuro(o.salaryMax) })
      : formatEuro(o.salaryMin);
  return t("salary", {
    amount,
    period: t(`periods.${o.salaryPeriod}`),
    basis: t(`bases.${o.salaryBasis}`),
  });
}
