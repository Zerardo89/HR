"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/identity";
import { sendCompanyVerifiedEmail } from "@/modules/notifications";
import { verifyCompanyManually } from "./verification";

/** Verifica manuale di un'azienda "in verifica" (solo moderatori e admin, con 2FA). */
export async function verifyCompanyAction(form: FormData): Promise<void> {
  const user = await requireUser(["moderator", "admin"]);
  const companyId = z.uuid().safeParse(form.get("companyId"));
  if (!companyId.success) redirect("/moderazione?esito=invalid");
  const result = await verifyCompanyManually(
    { db: getDb(), now: () => new Date() },
    user.id,
    companyId.data,
  );
  if (result.status === "verified") await sendCompanyVerifiedEmail(companyId.data);
  revalidatePath("/moderazione");
  redirect(`/moderazione?esito=company_${result.status}`);
}
