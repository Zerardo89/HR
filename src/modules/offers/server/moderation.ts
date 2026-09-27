import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog, companies, jobOffers, municipalities, users } from "@/lib/db/schema";
import { MAX_VALIDITY_DAYS, type ModerationDecision } from "../domain";
import type { OfferDeps } from "./deps";

const DAY_MS = 24 * 60 * 60_000;

/** Difesa in profondità: oltre alla pagina, anche il servizio controlla il ruolo nel DB. */
export async function isModerator(db: NodePgDatabase, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!u && u.status === "active" && (u.role === "moderator" || u.role === "admin");
}

export type PendingOffer = {
  id: string;
  title: string;
  description: string;
  companyName: string;
  companyStatus: "pending" | "verified" | "suspended";
  municipality: string;
  contractType: string;
  salary: string | null;
  issues: { code: string; severity: string }[];
  submittedAt: string | null;
};

/** Offerte in moderazione, dalla più vecchia (chi aspetta da più tempo passa prima). Solo dati pubblici. */
export async function listPendingOffers(db: NodePgDatabase): Promise<PendingOffer[]> {
  const rows = await db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      description: jobOffers.descriptionMd,
      companyName: companies.displayName,
      companyStatus: companies.status,
      municipality: municipalities.name,
      contractType: jobOffers.contractType,
      salaryMin: jobOffers.salaryMin,
      salaryMax: jobOffers.salaryMax,
      salaryPeriod: jobOffers.salaryPeriod,
      moderation: jobOffers.moderation,
    })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .where(eq(jobOffers.status, "pending_review"))
    .orderBy(asc(jobOffers.updatedAt));
  return rows.map((r) => {
    const m = r.moderation as {
      issues?: { code: string; severity: string }[];
      submittedAt?: string;
    };
    const salary =
      r.salaryMin == null
        ? null
        : `${Number(r.salaryMin)}${r.salaryMax != null ? `–${Number(r.salaryMax)}` : ""} € / ${r.salaryPeriod ?? "?"}`;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      companyName: r.companyName,
      companyStatus: r.companyStatus,
      municipality: r.municipality,
      contractType: r.contractType,
      salary,
      issues: m.issues ?? [],
      submittedAt: m.submittedAt ?? null,
    };
  });
}

export type DecisionResult = {
  status: "approved" | "rejected" | "not_found" | "not_allowed" | "company_not_verified";
};

/**
 * Approva (→ pubblicata, la scadenza parte ADESSO con i giorni chiesti dall'azienda) o rifiuta con motivo
 * (→ torna bozza, l'azienda vede il motivo). Ogni decisione va nel log di audit (docs/04 §7).
 */
export async function decideOffer(
  deps: OfferDeps,
  moderatorId: string,
  input: ModerationDecision,
): Promise<DecisionResult> {
  if (!(await isModerator(deps.db, moderatorId))) return { status: "not_allowed" };
  const now = deps.now();
  const [offer] = await deps.db
    .select({ moderation: jobOffers.moderation, companyStatus: companies.status })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(and(eq(jobOffers.id, input.offerId), eq(jobOffers.status, "pending_review")))
    .limit(1);
  if (!offer) return { status: "not_found" };

  const decision = {
    decision: input.decision === "approve" ? "approved" : "rejected",
    at: now.toISOString(),
    by: moderatorId,
    ...(input.decision === "reject" ? { reason: input.reason, note: input.note } : {}),
  };
  const merge = sql`${jobOffers.moderation} || ${JSON.stringify({ decision })}::jsonb`;

  if (input.decision === "approve") {
    if (offer.companyStatus !== "verified") return { status: "company_not_verified" };
    const requested = Number((offer.moderation as { validDays?: number }).validDays ?? 30);
    const days = Math.min(Math.max(Math.trunc(requested) || 30, 1), MAX_VALIDITY_DAYS);
    const [done] = await deps.db
      .update(jobOffers)
      .set({
        status: "published",
        publishedAt: now,
        validThrough: new Date(now.getTime() + days * DAY_MS),
        moderation: merge,
        updatedAt: now,
      })
      .where(and(eq(jobOffers.id, input.offerId), eq(jobOffers.status, "pending_review")))
      .returning({ id: jobOffers.id });
    if (!done) return { status: "not_found" };
  } else {
    const [done] = await deps.db
      .update(jobOffers)
      .set({ status: "draft", moderation: merge, updatedAt: now })
      .where(and(eq(jobOffers.id, input.offerId), eq(jobOffers.status, "pending_review")))
      .returning({ id: jobOffers.id });
    if (!done) return { status: "not_found" };
  }

  await deps.db.insert(auditLog).values({
    actorId: moderatorId,
    action: "offer.moderate",
    targetTable: "job_offers",
    targetId: input.offerId,
    purpose: input.decision === "approve" ? "approve" : `reject:${input.reason}`,
    at: now,
  });
  return { status: input.decision === "approve" ? "approved" : "rejected" };
}
