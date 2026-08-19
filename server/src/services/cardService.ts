import { visitingCardsRepo } from "../db/repositories/visitingCards.repo";
import { cardMessageRefsRepo } from "../db/repositories/cardMessageRefs.repo";
import { extractCardFromImages } from "../integrations/openai/vision";
import { supabaseStorage } from "../integrations/storage/supabaseStorage";
import { Channel, ExtractedCard, VisitingCard } from "../types/domain";
import { withScanSlot } from "./scanQueue";
import { childLogger } from "../lib/logger";

const log = childLogger("card-service");

export interface ProcessCardInput {
  userId: string;
  eventId: string | null;
  uploadedBy: Channel;
  imageId: string;
  imageBuffer: Buffer;
  mimeType: string;
  backImageId?: string;
  backImageBuffer?: Buffer;
  backMimeType?: string;
}

export interface ProcessCardResult {
  card: VisitingCard;
  extracted: ExtractedCard;
}

/** The one place both bots turn a business-card photo into a
 * `visiting_cards` row: extract structured fields with GPT-4o vision
 * (merging both sides in one call when a back image is present), persist
 * the row, then upload the original photo(s) to Supabase Storage and link
 * them back onto the row. */
export async function processCardImage(input: ProcessCardInput): Promise<ProcessCardResult> {
  // The vision call + storage uploads are the expensive, resource-heavy
  // part of a scan — bounded by withScanSlot so a burst of simultaneous
  // photos can't push memory past PM2's restart cap. Anything beyond the
  // concurrency cap queues here rather than firing unbounded work.
  return withScanSlot(async () => {
    const extracted = await extractCardFromImages(
      input.imageBuffer,
      input.mimeType,
      input.backImageBuffer,
      input.backMimeType,
    );

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

    if (input.backImageBuffer && input.backImageId) {
      try {
        const { path, publicUrl } = await supabaseStorage.uploadCardImage(
          input.userId,
          input.backImageId,
          input.backImageBuffer,
        );
        await visitingCardsRepo.setBackImageStorage(card.id, path, publicUrl);
      } catch (err) {
        log.error({ err, cardId: card.id }, "failed to upload back card image to storage");
      }
    }

    return { card, extracted };
  });
}

/** Registers a message as a valid voice-note reply-anchor for this card —
 * called for the front photo (legacy column, kept for old cards), the back
 * photo, the "add a voice note" hint, and the summary message. See
 * cardMessageRefs.repo.ts and the audio/voice handlers. */
export async function linkCardToInboundMessage(cardId: string, messageId: string): Promise<void> {
  await Promise.all([visitingCardsRepo.setMessageId(cardId, messageId), cardMessageRefsRepo.addRef(cardId, messageId)]);
}

export async function registerCardMessageRef(cardId: string, messageId: string): Promise<void> {
  await cardMessageRefsRepo.addRef(cardId, messageId);
}
