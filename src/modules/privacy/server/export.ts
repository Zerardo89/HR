import { and, asc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { decryptPii, dekContextFor } from "@/lib/crypto";
import {
  applications,
  auditLog,
  companies,
  companyMembers,
  consents,
  jobOffers,
  municipalities,
  occupations,
  profileLanguages,
  profileOccupations,
  provinces,
  savedSearches,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { describeAlert, alertQuery } from "@/modules/notifications/domain";
import { workerPiiSchema } from "@/modules/profiles/domain";
import { dbAuditSink } from "./audit";
import type { PrivacyDeps } from "./worker-pii";

/*
 * Esportazione dei miei dati (WP-023, R-PRIV-04, art. 15 e 20 GDPR): un file JSON leggibile, con le chiavi in
 * italiano. Solo i dati della persona: di chi ha letto i suoi dati si dice la categoria (tu, un'azienda a cui ti sei
 * candidata/o, il sistema per un avviso) e lo scopo, non l'identità (sarebbe un dato personale di altri).
 * Ogni decifratura è registrata con lo scopo `privacy.export`.
 */

const PURPOSE = "privacy.export";

export type MyDataExport = Record<string, unknown>;

function accessor(actorId: string, userId: string): string {
  if (actorId === userId) return "tu";
  if (actorId.startsWith("system:")) return "sistema (email di servizio)";
  return "azienda a cui ti sei candidata/o";
}

export async function exportMyData(
  deps: PrivacyDeps,
  userId: string,
): Promise<MyDataExport | null> {
  const [user] = await deps.db
    .select({
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      totpEnabledAt: users.totpEnabledAt,
      emailEnc: users.emailEnc,
      dekWrapped: users.dekWrapped,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status === "deleted" || !user.dekWrapped) return null;

  const audit = dbAuditSink(deps.db, deps.now);
  const common = {
    provider: deps.keys,
    audit,
    actorId: userId,
    purpose: PURPOSE,
    dekWrapped: user.dekWrapped,
    dekContext: dekContextFor("users", userId),
  };
  const email = await decryptPii({
    ...common,
    token: user.emailEnc,
    location: { table: "users", column: "email_enc", rowId: userId },
    schema: z.string(),
  });

  const [myConsents, [profile], occ, langs, apps, searches, memberships] = await Promise.all([
    deps.db
      .select({
        tipo: consents.type,
        versione: consents.version,
        datoIl: consents.grantedAt,
        revocatoIl: consents.revokedAt,
      })
      .from(consents)
      .where(eq(consents.userId, userId))
      .orderBy(asc(consents.grantedAt)),
    deps.db
      .select({
        p: workerProfiles,
        comune: municipalities.name,
        provincia: provinces.abbreviation,
      })
      .from(workerProfiles)
      .innerJoin(municipalities, eq(municipalities.istatCode, workerProfiles.municipalityCode))
      .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
      .where(eq(workerProfiles.userId, userId))
      .limit(1),
    deps.db
      .select({ mansione: occupations.labelIt })
      .from(profileOccupations)
      .innerJoin(occupations, eq(occupations.id, profileOccupations.occupationId))
      .where(eq(profileOccupations.userId, userId)),
    deps.db
      .select({ lingua: profileLanguages.languageCode, livello: profileLanguages.level })
      .from(profileLanguages)
      .where(eq(profileLanguages.userId, userId)),
    deps.db
      .select({
        id: applications.id,
        offerta: jobOffers.title,
        azienda: companies.displayName,
        stato: applications.status,
        inviataIl: applications.createdAt,
        vistaIl: applications.viewedAt,
        chiusaIl: applications.closedAt,
        messageEnc: applications.messageEnc,
      })
      .from(applications)
      .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
      .innerJoin(companies, eq(companies.id, jobOffers.companyId))
      .where(eq(applications.workerUserId, userId))
      .orderBy(asc(applications.createdAt)),
    deps.db
      .select({
        params: savedSearches.params,
        frequenza: savedSearches.frequency,
        creatoIl: savedSearches.createdAt,
      })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId)),
    deps.db
      .select({
        azienda: companies.displayName,
        ruolo: companyMembers.role,
        dal: companyMembers.createdAt,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(companyMembers.userId, userId)),
  ]);

  const pii = profile?.p.piiEnc
    ? await decryptPii({
        ...common,
        token: profile.p.piiEnc,
        location: { table: "worker_profiles", column: "pii_enc", rowId: userId },
        schema: workerPiiSchema,
      })
    : null;
  const candidature = [];
  for (const a of apps) {
    const messaggio = a.messageEnc
      ? await decryptPii({
          ...common,
          token: a.messageEnc,
          location: { table: "applications", column: "message_enc", rowId: a.id },
          schema: z.string(),
        })
      : null;
    candidature.push({
      offerta: a.offerta,
      azienda: a.azienda,
      stato: a.stato,
      inviataIl: a.inviataIl,
      vistaIl: a.vistaIl,
      chiusaIl: a.chiusaIl,
      messaggio,
    });
  }

  const reads = await deps.db
    .select({ quando: auditLog.at, actorId: auditLog.actorId, scopo: auditLog.purpose })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "pii.decrypt"),
        or(
          eq(auditLog.targetId, userId),
          apps.length > 0
            ? inArray(
                auditLog.targetId,
                apps.map((a) => a.id),
              )
            : undefined,
        ),
      ),
    )
    .orderBy(asc(auditLog.at));

  return {
    generatoIl: deps.now().toISOString(),
    account: {
      email,
      ruolo: user.role,
      creatoIl: user.createdAt,
      ultimaAttivita: user.lastActiveAt,
      verificaInDuePassaggi: user.totpEnabledAt !== null,
    },
    consensi: myConsents,
    profilo: profile
      ? {
          stato: profile.p.state,
          comune: `${profile.comune} (${profile.provincia})`,
          raggioKm: profile.p.radiusKm,
          regioniDoveTrasferirsi: profile.p.relocationRegionCodes.map((c) => c.trim()),
          esperienza: profile.p.experienceBand,
          disponibileDal: profile.p.availableFrom,
          contratti: profile.p.contractPrefs,
          orari: profile.p.schedulePrefs,
          patenti: profile.p.drivingLicenses,
          mansioni: occ.map((o) => o.mansione),
          lingue: langs,
          mailMensile: profile.p.monthlyCheckOptIn,
          datiIdentificativi: pii,
        }
      : null,
    candidature,
    avvisi: searches.map((s) => ({
      ricerca: describeAlert(alertQuery(s.params)),
      frequenza: s.frequenza,
      creatoIl: s.creatoIl,
    })),
    aziende: memberships,
    lettureDeiTuoiDatiCifrati: reads.map((r) => ({
      quando: r.quando,
      chi: accessor(r.actorId, userId),
      scopo: r.scopo,
    })),
  };
}
