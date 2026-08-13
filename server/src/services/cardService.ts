import { visitingCardsRepo } from "../db/repositories/visitingCards.repo";
import { extractCardFromImage } from "../integrations/openai/vision";
import { supabaseStorage } from "../integrations/storage/supabaseStorage";
import { Channel, ExtractedCard, VisitingCard } from "../types/domain";
import { childLogger } from "../lib/logger";

const log = childLogger("card-service");

export interface ProcessCardInput {
  userId: string;
  eventId: string | null;
  uploadedBy: Channel;
  imageId: string;
  imageBuffer: Buffer;
  mimeType: string;
}

export interface ProcessCardResult {
  card: VisitingCard;
  extracted: ExtractedCard;
}

/** The one place both bots turn a business-card photo into a
 * `visiting_cards` row: extract structured fields with GPT-4o vision,
 * persist the row, then upload the original photo to Supabase Storage and
 * link it back onto the row. */
export async function processCardImage(input: ProcessCardInput): Promise<ProcessCardResult> {
  const extracted = await extractCardFromImage(input.imageBuffer, input.mimeType);

  const card = await visitingCardsRepo.create({
    userId: input.userId,
    eventId: input.eventId,
    uploadedBy: input.uploadedBy,
    extracted,
  });

  try {
    const { path, publicUrl } = await supabaseStorage.uploadCardImage(
      input.userId,
      input.imageId,
      input.imageBuffer,
    );
    await visitingCardsRepo.setImageStorage(card.id, path, publicUrl);
  } catch (err) {
    // The card record and extracted contact details are already safely
    // saved — losing the source photo shouldn't fail the whole scan.
    log.error({ err, cardId: card.id }, "failed to upload card image to storage");
  }

  return { card, extracted };
}

export async function linkCardToInboundMessage(cardId: string, messageId: string): Promise<void> {
  await visitingCardsRepo.setMessageId(cardId, messageId);
}
