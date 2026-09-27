import { eq } from "drizzle-orm";
import {
  companies,
  companyMembers,
  companySites,
  municipalities,
  provinces,
  users,
} from "@/lib/db/schema";
import { normalizeTerm } from "@/modules/taxonomy/domain";
import { parseViesAddress, type CompanyInput, type ViesAddress } from "../domain";
import type { CompanyDeps } from "./deps";

export type RegisterResult =
  | { status: "created"; companyId: string; verified: boolean }
  | { status: "already_registered" }
  | { status: "vat_invalid" }
  | { status: "not_allowed" };

/**
 * Registra l'azienda di un utente con ruolo `company_member` (WP-011), che ne diventa titolare (`owner`).
 * - P.IVA valida su VIES → "verificata", ragione sociale da VIES (§3.2), sede legale dal suo indirizzo;
 * - VIES non disponibile → "in verifica" (la verifica la completa un moderatore);
 * - agenzia per il lavoro → sempre "in verifica": l'autorizzazione si controlla a mano sull'Albo (R-LAV-03).
 * Una P.IVA già registrata non si registra di nuovo: ci si fa invitare da chi l'ha registrata.
 */
export async function registerCompany(
  deps: CompanyDeps,
  userId: string,
  input: CompanyInput,
): Promise<RegisterResult> {
  const [user] = await deps.db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.role !== "company_member" || user.status !== "active")
    return { status: "not_allowed" };

  const [existing] = await deps.db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.vatNumber, input.vat))
    .limit(1);
  if (existing) return { status: "already_registered" };

  const vies = await deps.vies.check(input.vat);
  if (vies.status === "invalid") return { status: "vat_invalid" };

  const now = deps.now();
  const viesValid = vies.status === "valid";
  const verified = viesValid && input.kind === "employer";
  const seat = viesValid ? await resolveMunicipality(deps, parseViesAddress(vies.address)) : null;

  return deps.db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({
        vatNumber: input.vat,
        legalName: (viesValid && vies.name) || input.displayName,
        displayName: input.displayName,
        kind: input.kind,
        agencyAuthorization: input.agencyAuthorization ?? null,
        status: verified ? "verified" : "pending",
        verifiedAt: verified ? now : null,
        verification: { method: "vies", viesStatus: vies.status, checkedAt: now.toISOString() },
        createdAt: now,
      })
      .onConflictDoNothing({ target: companies.vatNumber })
      .returning({ id: companies.id });
    if (!company) return { status: "already_registered" } as const;

    await tx
      .insert(companyMembers)
      .values({ companyId: company.id, userId, role: "owner", createdAt: now });
    if (seat) {
      // La sede legale certificata da VIES conta subito per la zona gratuita (ADR-0009).
      await tx.insert(companySites).values({
        companyId: company.id,
        municipalityCode: seat,
        label: "Sede legale",
        isLegalSeat: true,
        approvedAt: now,
        createdAt: now,
      });
    }
    return { status: "created", companyId: company.id, verified } as const;
  });
}

/** Dal "CAP COMUNE SIGLA" di VIES al codice ISTAT del comune (confronto senza accenti e punteggiatura). */
async function resolveMunicipality(
  deps: CompanyDeps,
  address: ViesAddress | null,
): Promise<string | null> {
  if (!address) return null;
  const candidates = await deps.db
    .select({ code: municipalities.istatCode, name: municipalities.name })
    .from(municipalities)
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(provinces.abbreviation, address.provinceAbbr));
  const wanted = normalizeTerm(address.city);
  return candidates.find((c) => normalizeTerm(c.name) === wanted)?.code ?? null;
}
