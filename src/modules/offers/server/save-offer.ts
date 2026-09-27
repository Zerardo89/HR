import { and, eq, inArray } from "drizzle-orm";
import { jobOffers, occupations } from "@/lib/db/schema";
import { loadCompanyEntitlements } from "@/modules/billing";
import { activeEntitlement } from "@/modules/billing/domain";
import { findMunicipality } from "@/modules/geo";
import { isInFreeZone } from "@/modules/matching/domain";
import { OTHER_PLACE, validateOffer, type Hint, type Issue, type OfferInput } from "../domain";
import {
  getCompanyOfferContext,
  internshipMinimum,
  type CompanyOfferContext,
} from "./company-context";
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
  | { status: "invalid_place"; options: string[] }
  | { status: "not_allowed" | "invalid_site" | "invalid_occupation" | "not_editable" };

type Workplace = {
  siteId: string | null;
  municipalityCode: string;
  internshipMonthlyMinimum: number | null;
  /** Fuori dalla zona gratuita (regione ∪ 50 km dalle sedi approvate, ADR-0009). */
  outsideFreeZone: boolean;
};

/** Luogo di lavoro: una sede approvata (sempre in zona) oppure un altro comune scritto dall'azienda. */
async function resolveWorkplace(
  deps: OfferDeps,
  ctx: CompanyOfferContext,
  input: OfferInput,
  now: Date,
): Promise<
  Workplace | { status: "invalid_site" } | { status: "invalid_place"; options: string[] }
> {
  if (input.siteId !== OTHER_PLACE) {
    const site = ctx.sites.find((s) => s.id === input.siteId);
    if (!site) return { status: "invalid_site" };
    return {
      siteId: site.id,
      municipalityCode: site.municipalityCode,
      internshipMonthlyMinimum: site.internshipMonthlyMinimum,
      outsideFreeZone: false,
    };
  }
  const lookup = await findMunicipality(deps.db, input.place ?? "");
  if (lookup.status !== "found") {
    const places = lookup.status === "ambiguous" ? lookup.options : lookup.suggestions;
    return {
      status: "invalid_place",
      options: places.map((p) => `${p.name} (${p.provinceAbbr})`),
    };
  }
  const place = lookup.place;
  const inZone = isInFreeZone(
    ctx.sites.map((s) => ({
      municipalityCode: s.municipalityCode,
      regionCode: s.regionCode,
      approved: true,
      location: { lat: s.lat, lon: s.lon },
    })),
    {
      municipalityCode: place.code,
      regionCode: place.regionCode,
      location: { lat: place.lat, lon: place.lon },
    },
  );
  return {
    siteId: null,
    municipalityCode: place.code,
    internshipMonthlyMinimum: await internshipMinimum(deps.db, place.regionCode, now),
    outsideFreeZone: !inZone,
  };
}

/**
 * Salva un'offerta (WP-013). `draft`: salva e basta. `publish`: applica il validatore (WP-012) e
 * - errori → resta bozza e si restituiscono i problemi;
 * - da moderare → "in moderazione" (la scadenza parte dall'approvazione);
 * - tutto a posto → pubblicata subito, scadenza tra `validDays` giorni (R-ANN-07).
 * Si modificano solo bozze e offerte in moderazione della PROPRIA azienda.
 * Luogo di lavoro fuori dalla zona gratuita → serve il Piano Nazionale; l'offerta diventa `national` (WP-016).
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
  const workplace = await resolveWorkplace(deps, ctx, input, now);
  if ("status" in workplace) return workplace;
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
      internshipMonthlyMinimum: workplace.internshipMonthlyMinimum,
    },
  );

  // Fuori zona serve il Piano Nazionale (gratis per le aziende fondatrici fino a fine periodo, WP-016).
  const zoneIssue: Issue | null =
    workplace.outsideFreeZone &&
    !activeEntitlement(await loadCompanyEntitlements(deps.db, ctx.companyId), "national", now)
      ? { code: "outside_free_zone", rule: "ADR-0009", severity: "error", field: "company" }
      : null;
  const issues = zoneIssue ? [...result.issues, zoneIssue] : result.issues;
  const decision = zoneIssue ? "blocked" : result.decision;

  const target =
    mode === "draft" || decision === "blocked"
      ? "draft"
      : decision === "moderation"
        ? "pending_review"
        : "published";

  const values = {
    companyId: ctx.companyId,
    siteId: workplace.siteId,
    occupationId: input.occupationId,
    municipalityCode: workplace.municipalityCode,
    scope: workplace.outsideFreeZone ? ("national" as const) : ("local" as const),
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
      issues: issues.map((i) => ({ code: i.code, rule: i.rule, severity: i.severity })),
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

  if (mode === "publish" && decision === "blocked") {
    return { status: "blocked", offerId: id, issues, hints: result.hints };
  }
  return { status: "saved", offerId: id, offerStatus: target, issues, hints: result.hints };
}
