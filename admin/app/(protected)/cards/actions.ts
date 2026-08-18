"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminCardsRepo } from "../../../lib/repositories/adminCards.repo";
import { reExtractCardFromImageUrl } from "../../../lib/vision";
import { writeAuditLog } from "../../../lib/auditLog";

function flattenAddress(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.postal_code, address.country].filter(
    (part) => part && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function rerunExtractionAction(cardId: string): Promise<void> {
  const admin = await requireAdmin();
  const card = await adminCardsRepo.getCardById(cardId);
  if (!card) throw new Error("Card not found.");
  if (!card.image_public_url) throw new Error("This card has no stored image to re-run.");

  const extracted = await reExtractCardFromImageUrl(card.image_public_url);
  const socialMedia = (extracted.social_media as Record<string, string>) ?? {};

  await adminCardsRepo.updateExtractedFields(cardId, {
    full_name: (extracted.person_name as string) || null,
    position: (extracted.job_title as string) || null,
    company_name: (extracted.company_name as string) || null,
    address: flattenAddress(extracted.address as Record<string, string>),
    phone1: (extracted.primary_phone as string) || null,
    phone2: (extracted.secondary_phone as string) || null,
    business_email: (extracted.primary_email as string) || null,
    personal_email: (extracted.secondary_email as string) || null,
    website: (extracted.website as string) || null,
    linkedin: socialMedia.linkedin || null,
    twitter: socialMedia.twitter || null,
    facebook: socialMedia.facebook || null,
    extraction_confidence: typeof extracted.confidence === "number" ? extracted.confidence : null,
  });

  await writeAuditLog({
    adminUserId: admin.id,
    action: "card.rerun_extraction",
    targetTable: "visiting_cards",
    targetId: cardId,
  });

  revalidatePath("/cards");
}
