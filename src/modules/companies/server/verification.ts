import { asc, eq, and, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog, companies, users } from "@/lib/db/schema";

export type PendingCompany = {
  id: string;
  displayName: string;
  legalName: string;
  vatNumber: string;
  kind: "employer" | "agency";
  agencyAuthorization: string | null;
  viesStatus: string | null;
  createdAt: Date;
};

/** Aziende "in verifica" (VIES non ha risposto, o agenzie da controllare sull'Albo). Solo dati pubblici. */
export async function listPendingCompanies(db: NodePgDatabase): Promise<PendingCompany[]> {
  const rows = await db
    .select({
      id: companies.id,
      displayName: companies.displayName,
      legalName: companies.legalName,
      vatNumber: companies.vatNumber,
      kind: companies.kind,
      agencyAuthorization: companies.agencyAuthorization,
      verification: companies.verification,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .where(eq(companies.status, "pending"))
    .orderBy(asc(companies.createdAt));
  return rows.map(({ verification, ...r }) => ({
    ...r,
    viesStatus: (verification as { viesStatus?: string }).viesStatus ?? null,
  }));
}

/**
 * Verifica manuale (WP-013b): il moderatore ha controllato la P.IVA (e, per le agenzie, l'autorizzazione
 * sull'Albo informatico, R-LAV-03). Resta nel log di audit.
 */
export async function verifyCompanyManually(
  deps: { db: NodePgDatabase; now: () => Date },
  moderatorId: string,
  companyId: string,
): Promise<{ status: "verified" | "not_found" | "not_allowed" }> {
  const [moderator] = await deps.db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, moderatorId))
    .limit(1);
  if (
    !moderator ||
    moderator.status !== "active" ||
    !["moderator", "admin"].includes(moderator.role)
  ) {
    return { status: "not_allowed" };
  }
  const now = deps.now();
  const manual = { method: "manual", by: moderatorId, checkedAt: now.toISOString() };
  const [done] = await deps.db
    .update(companies)
    .set({
      status: "verified",
      verifiedAt: now,
      verification: sql`${companies.verification} || ${JSON.stringify(manual)}::jsonb`,
    })
    .where(and(eq(companies.id, companyId), eq(companies.status, "pending")))
    .returning({ id: companies.id });
  if (!done) return { status: "not_found" };
  await deps.db.insert(auditLog).values({
    actorId: moderatorId,
    action: "company.verify",
    targetTable: "companies",
    targetId: companyId,
    purpose: "manual",
    at: now,
  });
  return { status: "verified" };
}
