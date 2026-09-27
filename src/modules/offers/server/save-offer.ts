import { and, eq, inArray } from "drizzle-orm";
import { jobOffers, occupations } from "@/lib/db/schema";
import { validateOffer, type Hint, type Issue, type OfferInput } from "../domain";
import { getCompanyOfferContext } from "./company-context";
import type { OfferDeps } from "./deps";

const DAY_MS = 24 * 60 * 60_000;

export type SaveOfferResult =
  | {
      status: "saved";
      offerId: string;
      offerStatus: "draft" | "pending_review" | "published";
      issues: Issue[];
      hints: Hint[];
    }
  | { status: "blocked"; offerId: string; issues: Issue[]; hints: Hint[] }
  | { status: "not_allowed" | "invalid_site" | "invalid_occupation" | "not_editable" };

/**
 * Salva un'offerta (WP-013). `draft`: salva e basta. `publish`: applica il validatore (WP-012) e
 * - errori → resta bozza e si restituiscono i problemi;
 * - da moderare → "in moderazione" (la scadenza parte dall'approvazione);
 * - tutto a posto → pubblicata subito, scadenza tra `validDays` giorni (R-ANN-07).
 * Si modificano solo bozze e offerte in moderazione della PROPRIA azienda.
 */
export async function saveOffer(
  deps: OfferDeps,
  userId: string,
  input: OfferInput,
  mode: "draft" | "publish",
  offerId?: string,
): Promise<SaveOfferResult> {
  const now = deps.now();
  const ctx = await getCompanyOfferContext(deps.db, userId, input.companyId, now);
  if (!ctx || ctx.validatorCompany.status === "suspended") return { status: "not_allowed" };
  const site = ctx.sites.find((s) => s.id === input.siteId);
  if (!site) return { status: "invalid_site" };
  const [occupation] = await deps.db
    .select({ id: occupations.id })
    .from(occupations)
    .where(eq(occupations.id, input.occupationId))
    .limit(1);
  if (!occupation) return { status: "invalid_occupation" };

  if (offerId) {
    const [existing] = await deps.db
      .select({ status: jobOffers.status })
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.companyId, ctx.companyId)))
      .limit(1);
    if (!existing) return { status: "not_allowed" };
    if (existing.status !== "draft" && existing.status !== "pending_review") {
      return { status: "not_editable" };
    }
  }

  const validThrough = new Date(now.getTime() + input.validDays * DAY_MS);
  const result = validateOffer(
    {
      title: input.title,
      description: input.description,
      contractType: input.contractType,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryPeriod: input.salaryPeriod ?? null,
      ccnl: input.ccnl ?? null,
      validThrough,
      internshipDeclaration: input.internshipDeclaration,
    },
    {
      now,
      company: ctx.validatorCompany,
      internshipMonthlyMinimum: site.internshipMonthlyMinimum,
    },
  );

  const target =
    mode === "draft" || result.decision === "blocked"
      ? "draft"
      : result.decision === "moderation"
        ? "pending_review"
        : "published";

  const values = {
    companyId: ctx.companyId,
    siteId: site.id,
    occupationId: input.occupationId,
    municipalityCode: site.municipalityCode,
    title: input.title,
    descriptionMd: input.description,
    contractType: input.contractType,
    schedule: input.schedule,
    hoursPerWeek: input.hoursPerWeek ?? null,
    salaryMin: input.salaryMin != null ? String(input.salaryMin) : null,
    salaryMax: input.salaryMax != null ? String(input.salaryMax) : null,
    salaryPeriod: input.salaryPeriod ?? null,
    salaryBasis: input.salaryBasis,
    ccnl: input.ccnl ?? null,
    status: target,
    publishedAt: target === "published" ? now : null,
    validThrough: target === "published" ? validThrough : null,
    // Per la moderazione: cosa ha segnalato il validatore e quanti giorni di validità chiede l'azienda.
    moderation: {
      validDays: input.validDays,
      issues: result.issues.map((i) => ({ code: i.code, rule: i.rule, severity: i.severity })),
      submittedAt: target === "pending_review" ? now.toISOString() : undefined,
    },
    updatedAt: now,
  } as const;

  let id = offerId;
  if (id) {
    await deps.db
      .update(jobOffers)
      .set(values)
      .where(
        and(
          eq(jobOffers.id, id),
          eq(jobOffers.companyId, ctx.companyId),
          inArray(jobOffers.status, ["draft", "pending_review"]),
        ),
      );
  } else {
    const [created] = await deps.db
      .insert(jobOffers)
      .values({ ...values, createdAt: now })
      .returning({ id: jobOffers.id });
    id = created!.id;
  }

  if (mode === "publish" && result.decision === "blocked") {
    return { status: "blocked", offerId: id, issues: result.issues, hints: result.hints };
  }
  return {
    status: "saved",
    offerId: id,
    offerStatus: target,
    issues: result.issues,
    hints: result.hints,
  };
}
