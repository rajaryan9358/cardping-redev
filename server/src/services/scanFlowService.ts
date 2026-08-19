import { usersRepo } from "../db/repositories/users.repo";
import { Channel, ExtractedCard, UserWithEvent, VisitingCard } from "../types/domain";
import { processCardImage, linkCardToInboundMessage } from "./cardService";
import { chargeForCardScan } from "./coinService";
import { isEventExpired } from "./eventService";

export type ScanAction = "ask_event" | "ask_back_photo" | "finalize";

/** Pure decision, no side effects — what should happen with a just-received
 * front photo, given the account's event/scan-both-sides state. Shared by
 * the immediate scan path (handleImage/handlePhoto) and every resumed path
 * (after the event picker, after the back photo) so they can't drift. */
export function decideScanAction(user: UserWithEvent): ScanAction {
  if (!user.active_event_id || isEventExpired(user)) return "ask_event";
  if (user.scan_both_sides && !user.pending_back_media_id) return "ask_back_photo";
  return "finalize";
}

export interface FinalizeScanInput {
  userId: string;
  accountId: string | null;
  eventId: string;
  channel: Channel;
  messageId: string;
  frontImageId: string;
  frontImageBuffer: Buffer;
  frontMimeType: string;
  backImageId?: string;
  backImageBuffer?: Buffer;
  backMimeType?: string;
}

export interface FinalizeScanResult {
  card: VisitingCard;
  extracted: ExtractedCard;
}

/** The persist/charge tail every scan goes through, whether it finalized
 * immediately or was resumed after the event picker / back photo —
 * channel-specific message rendering (summary text, contact card) stays in
 * each bot's own handler, which calls this first and then sends based on
 * what it returns. */
export async function finalizeScan(input: FinalizeScanInput): Promise<FinalizeScanResult> {
  const { card, extracted } = await processCardImage({
    userId: input.userId,
    eventId: input.eventId,
    uploadedBy: input.channel,
    imageId: input.frontImageId,
    imageBuffer: input.frontImageBuffer,
    mimeType: input.frontMimeType,
    backImageId: input.backImageId,
    backImageBuffer: input.backImageBuffer,
    backMimeType: input.backMimeType,
  });

  await Promise.all([
    linkCardToInboundMessage(card.id, input.messageId),
    usersRepo.setActiveVisitingCard(input.userId, card.id),
    chargeForCardScan(input.userId, input.accountId),
    usersRepo.setPendingMedia(input.userId, null, null),
  ]);

  return { card, extracted };
}
