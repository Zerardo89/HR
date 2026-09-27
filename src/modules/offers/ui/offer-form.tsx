"use client";

import { useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CONTRACT_TYPES,
  MAX_VALIDITY_DAYS,
  OTHER_PLACE,
  SALARY_BASES,
  SALARY_PERIODS,
  SCHEDULE_TYPES,
  validateOffer,
  type ContractType,
  type Issue,
  type OfferContext,
  type SalaryPeriod,
} from "../domain";
import { saveOfferAction, type SaveOfferState } from "../server/actions";

export type OfferFormSite = {
  id: string;
  label: string;
  municipalityName: string;
  internshipMonthlyMinimum: number | null;
};

type Values = Record<
  | "siteId"
  | "place"
  | "title"
  | "description"
  | "contractType"
  | "schedule"
  | "hoursPerWeek"
  | "salaryMin"
  | "salaryMax"
  | "salaryPeriod"
  | "salaryBasis"
  | "ccnl"
  | "validDays",
  string
>;

const EMPTY: Values = {
  siteId: "",
  place: "",
  title: "",
  description: "",
  contractType: "permanent",
  schedule: "full_time",
  hoursPerWeek: "",
  salaryMin: "",
  salaryMax: "",
  salaryPeriod: "month",
  salaryBasis: "gross",
  ccnl: "",
  validDays: "30",
};

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";
const labelCls = "flex flex-col gap-2 text-base font-medium";
const amount = (v: string) =>
  v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", "."));

/**
 * Form dell'offerta (WP-013). Il validatore degli annunci (WP-012) gira anche qui, mentre si scrive:
 * l'azienda vede subito cosa correggere. Il server lo riapplica comunque prima di pubblicare.
 */
export function OfferForm({
  companyId,
  company,
  sites,
  occupationField,
  offerId,
  initial,
  nowIso,
}: {
  /** Istante del rendering sul server (il componente non legge l'orologio durante il rendering). */
  nowIso: string;
  companyId: string;
  company: OfferContext["company"];
  sites: OfferFormSite[];
  occupationField: ReactNode;
  offerId?: string;
  initial?: Partial<Values>;
}) {
  const t = useTranslations("offers.form");
  const ti = useTranslations("offers.issues");
  const [values, setValues] = useState<Values>({
    ...EMPTY,
    siteId: sites[0]?.id ?? "",
    ...initial,
  });
  const [declaration, setDeclaration] = useState(false);
  const [state, action, pending] = useActionState<SaveOfferState, FormData>(saveOfferAction, {
    status: "idle",
  });
  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const site = sites.find((s) => s.id === values.siteId);
  const live = useMemo(
    () =>
      validateOffer(
        {
          title: values.title,
          description: values.description,
          contractType: values.contractType as ContractType,
          salaryMin: amount(values.salaryMin),
          salaryMax: amount(values.salaryMax),
          salaryPeriod: (values.salaryPeriod || null) as SalaryPeriod | null,
          ccnl: values.ccnl,
          validThrough: new Date(
            Date.parse(nowIso) + Number(values.validDays || 0) * 24 * 60 * 60_000,
          ),
          internshipDeclaration: declaration,
        },
        {
          now: new Date(nowIso),
          company,
          internshipMonthlyMinimum: site?.internshipMonthlyMinimum ?? null,
        },
      ),
    [values, declaration, company, site, nowIso],
  );
  // Mentre si scrive, le frasi troppo corte non sono ancora un "problema".
  const shown = live.issues.filter(
    (i) =>
      !(["title_length", "description_too_short"].includes(i.code) && values.description === ""),
  );
  const errors = shown.filter((i) => i.severity === "error");
  const reviews = shown.filter((i) => i.severity === "review");
  const issueText = (i: Issue) => `${ti(i.code)}${i.match ? ` («${i.match}»)` : ""}`;
  // Invio senza l'azzeramento automatico di React 19: i menu a tendina tornerebbero alla prima voce mentre lo
  // stato mostra ancora le scelte fatte, e al secondo invio partirebbero valori diversi da quelli visibili.
  // Senza JavaScript resta l'invio normale del form (`action`).
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(data));
  };
  // Dopo un blocco la bozza esiste già: il prossimo invio la aggiorna (niente offerte doppie).
  const savedId = offerId ?? (state.status === "blocked" ? state.offerId : undefined);
  // Problemi che solo il server conosce (es. zona gratuita, WP-016): il controllo dal vivo non li vede.
  const serverOnly =
    state.status === "blocked"
      ? state.issues.filter((i) => !live.issues.some((l) => l.code === i.code))
      : [];

  return (
    <form action={action} onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="companyId" value={companyId} />
      {savedId && <input type="hidden" name="offerId" value={savedId} />}

      <label className={labelCls}>
        {t("title")}
        <input
          name="title"
          required
          maxLength={120}
          value={values.title}
          onChange={set("title")}
          className={field}
        />
        <span className="text-sm font-normal text-muted">{t("titleHelp")}</span>
      </label>

      {occupationField}

      <label className={labelCls}>
        {t("site")}
        <select
          name="siteId"
          required
          value={values.siteId}
          onChange={set("siteId")}
          className={field}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {s.municipalityName}
            </option>
          ))}
          <option value={OTHER_PLACE}>{t("otherPlace")}</option>
        </select>
      </label>

      {values.siteId === OTHER_PLACE && (
        <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
          <label className={labelCls}>
            {t("placeLabel")}
            <input
              name="place"
              required
              maxLength={80}
              value={values.place}
              onChange={set("place")}
              autoComplete="address-level2"
              aria-describedby="luogo-aiuto"
              className={field}
            />
          </label>
          <p id="luogo-aiuto" className="text-sm text-muted">
            {t("placeHelp")}
          </p>
          {state.status === "invalid_place" && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-accent px-3 py-2"
            >
              <p>{t(state.options.length > 0 ? "placeChoose" : "placeNotFound")}</p>
              {state.options.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {state.options.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => setValues((v) => ({ ...v, place: option }))}
                        className="rounded-lg border border-primary px-3 py-2 font-medium text-primary"
                      >
                        {option}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <label className={labelCls}>
        {t("description")}
        <textarea
          name="description"
          required
          rows={8}
          maxLength={8000}
          value={values.description}
          onChange={set("description")}
          className={field}
        />
        <span className="text-sm font-normal text-muted">{t("descriptionHelp")}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          {t("contractType")}
          <select
            name="contractType"
            value={values.contractType}
            onChange={set("contractType")}
            className={field}
          >
            {CONTRACT_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`contracts.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          {t("schedule")}
          <select
            name="schedule"
            value={values.schedule}
            onChange={set("schedule")}
            className={field}
          >
            {SCHEDULE_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`schedules.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-base font-semibold">{t("salaryLegend")}</legend>
        <p className="text-sm text-muted">{t("salaryHelp")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            {t("salaryMin")}
            <input
              name="salaryMin"
              inputMode="decimal"
              value={values.salaryMin}
              onChange={set("salaryMin")}
              className={field}
            />
          </label>
          <label className={labelCls}>
            {t("salaryMax")}
            <input
              name="salaryMax"
              inputMode="decimal"
              value={values.salaryMax}
              onChange={set("salaryMax")}
              className={field}
            />
          </label>
          <label className={labelCls}>
            {t("salaryPeriod")}
            <select
              name="salaryPeriod"
              value={values.salaryPeriod}
              onChange={set("salaryPeriod")}
              className={field}
            >
              <option value="">{t("salaryPeriodNone")}</option>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`periods.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t("salaryBasis")}
            <select
              name="salaryBasis"
              value={values.salaryBasis}
              onChange={set("salaryBasis")}
              className={field}
            >
              {SALARY_BASES.map((b) => (
                <option key={b} value={b}>
                  {t(`bases.${b}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          {t("hoursPerWeek")}
          <input
            name="hoursPerWeek"
            inputMode="numeric"
            value={values.hoursPerWeek}
            onChange={set("hoursPerWeek")}
            className={field}
          />
        </label>
        <label className={labelCls}>
          {t("validDays")}
          <input
            name="validDays"
            type="number"
            min={1}
            max={MAX_VALIDITY_DAYS}
            value={values.validDays}
            onChange={set("validDays")}
            className={field}
          />
        </label>
      </div>

      <label className={labelCls}>
        {t("ccnl")}
        <input
          name="ccnl"
          maxLength={120}
          value={values.ccnl}
          onChange={set("ccnl")}
          className={field}
        />
      </label>

      {values.contractType === "internship" && (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="internshipDeclaration"
            checked={declaration}
            onChange={(e) => setDeclaration(e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          {t("internshipDeclaration")}
        </label>
      )}

      <section
        aria-live="polite"
        aria-labelledby="controllo-annuncio"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <h2 id="controllo-annuncio" className="text-lg font-semibold">
          {t("checkTitle")}
        </h2>
        {errors.length === 0 && reviews.length === 0 && <p>{t("checkOk")}</p>}
        {errors.length > 0 && (
          <div>
            <p className="font-medium">{t("checkErrors")}</p>
            <ul className="list-disc pl-5">
              {errors.map((i, n) => (
                <li key={`${i.code}-${n}`}>{issueText(i)}</li>
              ))}
            </ul>
          </div>
        )}
        {reviews.length > 0 && (
          <div>
            <p className="font-medium">{t("checkReviews")}</p>
            <ul className="list-disc pl-5">
              {reviews.map((i, n) => (
                <li key={`${i.code}-${n}`}>{issueText(i)}</li>
              ))}
            </ul>
          </div>
        )}
        {live.hints.length > 0 && (
          <ul className="list-disc pl-5 text-muted">
            {live.hints.map((h) => (
              <li key={h.code}>{t(`hints.${h.code}`)}</li>
            ))}
          </ul>
        )}
      </section>

      {state.status === "blocked" && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-accent px-3 py-2">
          <p>{t("blocked")}</p>
          {serverOnly.length > 0 && (
            <ul className="list-disc pl-5">
              {serverOnly.map((i, n) => (
                <li key={`${i.code}-${n}`}>{issueText(i)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-accent px-3 py-2">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? t("pending") : t("publish")}
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          formNoValidate
          disabled={pending}
          className="rounded-lg border border-border bg-surface px-4 py-3 text-lg font-semibold text-foreground disabled:opacity-60"
        >
          {t("saveDraft")}
        </button>
      </div>
    </form>
  );
}
