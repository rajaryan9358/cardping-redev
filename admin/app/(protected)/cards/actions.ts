"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminCardsRepo } from "../../../lib/repositories/adminCards.repo";
import { reExtractCardFromImageUrl, ExtractionProvider } from "../../../lib/vision";
import { writeAuditLog } from "../../../lib/auditLog";

// Mirrors visitingCards.repo.ts#joinLines on the server side — dedupes and
// newline-joins a repeatable extracted field into the one column it's
// stored in (a card can have more than one phone/email/address, see
// admin/lib/vision.ts's prompt).
function joinLines(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  const cleaned = Array.from(
    new Set(values.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter((v) => v.length > 0)),
  );
  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

export async function rerunExtractionAction(cardId: string, provider: ExtractionProvider, model: string): Promise<void> {
  const admin = await requireAdmin();
  const card = await adminCardsRepo.getCardById(cardId);
  if (!card) throw new Error("Card not found.");
  if (!card.image_public_url) throw new Error("This card has no stored image to re-run.");

  const extracted = await reExtractCardFromImageUrl(card.image_public_url, provider, model);
  const socialMedia = (extracted.social_media as Record<string, string>) ?? {};

  await adminCardsRepo.updateExtractedFields(cardId, {
    full_name: (extracted.person_name as string) || null,
    position: (extracted.job_title as string) || null,
    company_name: (extracted.company_name as string) || null,
    address: joinLines(extracted.addresses),
    phone1: joinLines(extracted.phones),
    business_email: joinLines(extracted.business_emails),
    personal_email: joinLines(extracted.personal_emails),
    website: joinLines(extracted.websites),
    linkedin: socialMedia.linkedin || null,
    twitter: socialMedia.twitter || null,
    facebook: socialMedia.facebook || null,
    qr_code_content: (extracted.qr_code_content as string) || null,
    additional_info: (extracted.additional_info as string) || null,
    extraction_confidence: typeof extracted.confidence === "number" ? extracted.confidence : null,
    extraction_provider: provider,
    extraction_model: model,
  });

  await writeAuditLog({
    adminUserId: admin.id,
    action: "card.rerun_extraction",
    targetTable: "visiting_cards",
    targetId: cardId,
    detail: { provider, model },
  });

  revalidatePath("/cards");
}

export interface CardFieldsPatch {
  full_name?: string | null;
  position?: string | null;
  company_name?: string | null;
  business_email?: string | null;
  personal_email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  website?: string | null;
  address?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  qr_code_content?: string | null;
  additional_info?: string | null;
  transcribed_note?: string | null;
}

export async function updateCardAction(cardId: string, patch: CardFieldsPatch): Promise<void> {
  const admin = await requireAdmin();
  await adminCardsRepo.updateExtractedFields(cardId, patch as Record<string, unknown>);
  await writeAuditLog({ adminUserId: admin.id, action: "card.update", targetTable: "visiting_cards", targetId: cardId, detail: patch });
  revalidatePath("/cards");
}

export async function deleteCardAction(cardId: string): Promise<void> {
  const admin = await requireAdmin();
  await adminCardsRepo.deleteCard(cardId);
  await writeAuditLog({ adminUserId: admin.id, action: "card.delete", targetTable: "visiting_cards", targetId: cardId });
  revalidatePath("/cards");
}

export async function bulkDeleteCardsAction(cardIds: string[]): Promise<void> {
  const admin = await requireAdmin();
  await adminCardsRepo.bulkDeleteCards(cardIds);
  await writeAuditLog({ adminUserId: admin.id, action: "card.bulk_delete", targetTable: "visiting_cards", detail: { cardIds } });
  revalidatePath("/cards");
}
