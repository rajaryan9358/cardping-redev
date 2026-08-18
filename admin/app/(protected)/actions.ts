"use server";

import { redirect } from "next/navigation";
import { destroySessionCookie, requireAdmin } from "../../lib/auth";
import { listApprovedTemplates, WhatsAppTemplate } from "../../lib/whatsappTemplates";

export async function logoutAction(): Promise<void> {
  await destroySessionCookie();
  redirect("/login");
}

/** Shared by the Send Message modal (Users) and the Broadcasts composer —
 * both need the same Meta-approved-templates list. */
export async function listWhatsAppTemplatesAction(): Promise<WhatsAppTemplate[]> {
  await requireAdmin();
  return listApprovedTemplates();
}
