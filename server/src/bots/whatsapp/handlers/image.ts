import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { ExtractedCard, UserWithEvent, VisitingCard } from "../../../types/domain";
import { hasEnoughCoinsForScan } from "../../../services/coinService";
import { decideScanAction, finalizeScan } from "../../../services/scanFlowService";
import { addToBatch, BatchOutcome } from "../../../services/imageBatchBuffer";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { formatEventLifetimeRemaining } from "../../../services/eventService";
import { childLogger } from "../../../lib/logger";
import { Copy, formatCardSummary, sendEventPicker } from "../messages";
import { Ids } from "../ids";

const log = childLogger("wa-image-handler");

export async function handleImage(msg: NormalizedWhatsAppMessage, user: UserWithEvent): Promise<void> {
  const { phoneNumberId, from } = msg;

  if (user.effective_blocked_at) {
    await whatsappClient.sendText(phoneNumberId, from, Copy.accountBlocked);
    return;
  }

  if (!hasEnoughCoinsForScan(user.effective_coin_balance)) {
    await sendOutOfCoins(phoneNumberId, from, user);
    return;
  }

  if (!msg.mediaId) {
    log.warn({ from }, "image message had no media id");
    return;
  }

  const action = decideScanAction(user);

  if (action === "ask_event") {
    await usersRepo.setPendingMedia(user.user_id, msg.mediaId, null);
    await usersRepo.setState(user.user_id, "awaiting_event_choice");
    await sendEventPicker(phoneNumberId, from, user.user_id);
    return;
  }

  // An active event exists, so we're clear to batch — hold this photo for
  // a short window to see if a second one (front+back, sent together)
  // follows, instead of committing to a single-image scan immediately.
  addToBatch(user.user_id, { mediaId: msg.mediaId, messageId: msg.waMessageId }, (outcome) => {
    handleBatchOutcome(phoneNumberId, from, user, outcome).catch((err) => {
      log.error({ err, from }, "failed to process batched image outcome");
    });
  });
}

/** Runs once the batch window closes — see imageBatchBuffer.ts. One photo
 * behaves like before (ask for the back, or finalize, depending on the
 * scan_both_sides preference); two are always treated as front+back since
 * sending them together is unambiguous; three or more are rejected outright
 * rather than guessed at. */
async function handleBatchOutcome(
  phoneNumberId: string,
  from: string,
  user: UserWithEvent,
  outcome: BatchOutcome,
): Promise<void> {
  if (outcome.kind === "too_many") {
    await whatsappClient.sendText(phoneNumberId, from, Copy.tooManyImages);
    return;
  }

  if (outcome.kind === "pair") {
    const [front, back] = await Promise.all([
      whatsappClient.downloadMediaById(outcome.front.mediaId),
      whatsappClient.downloadMediaById(outcome.back.mediaId),
    ]);
    await whatsappClient.sendText(phoneNumberId, from, Copy.processingCard);
    const { card, extracted } = await finalizeScan({
      userId: user.user_id,
      accountId: user.account_id,
      eventId: user.active_event_id!,
      channel: "whatsapp",
      messageId: outcome.back.messageId,
      frontImageId: outcome.front.mediaId,
      frontImageBuffer: front.buffer,
      frontMimeType: front.mimeType,
      backImageId: outcome.back.mediaId,
      backImageBuffer: back.buffer,
      backMimeType: back.mimeType,
    });
    await registerCardMessageRef(card.id, outcome.front.messageId);
    await sendScanResult(phoneNumberId, from, outcome.back.messageId, card, extracted, user);
    return;
  }

  // Single image — same decision the old immediate path made.
  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setPendingMedia(user.user_id, outcome.image.mediaId, null);
    await usersRepo.setState(user.user_id, "awaiting_back_photo");
    await whatsappClient.sendText(phoneNumberId, from, Copy.askForBackPhoto);
    return;
  }

  const { buffer, mimeType } = await whatsappClient.downloadMediaById(outcome.image.mediaId);
  await whatsappClient.sendText(phoneNumberId, from, Copy.processingCard);
  const { card, extracted } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "whatsapp",
    messageId: outcome.image.messageId,
    frontImageId: outcome.image.mediaId,
    frontImageBuffer: buffer,
    frontMimeType: mimeType,
  });

  await sendScanResult(phoneNumberId, from, outcome.image.messageId, card, extracted, user);
}

/** Renders the result of a finalized scan — reused by handleImage's
 * immediate path (has a real inbound message to thread the summary under)
 * and stateContinuation.ts's resumed-after-event/back-photo paths (no
 * natural message to reply to, so replyToMessageId is null there). Also
 * registers the summary and contact-card messages as voice-note reply
 * anchors, alongside the front/back photo already registered by
 * finalizeScan/the back-photo handler. */
export async function sendScanResult(
  phoneNumberId: string,
  from: string,
  replyToMessageId: string | null,
  card: VisitingCard,
  extracted: ExtractedCard,
  user: UserWithEvent,
): Promise<void> {
  const remaining = formatEventLifetimeRemaining(user.active_event_set_at, user.event_lifetime_hours);
  const eventLine = user.active_event_name ? `📁 Added to *${user.active_event_name}* — ${remaining}\n\n` : "";

  const summaryMessageId = await whatsappClient.sendText(
    phoneNumberId,
    from,
    formatCardSummary(extracted),
    replyToMessageId ? { replyToMessageId } : {},
  );
  if (summaryMessageId) await registerCardMessageRef(card.id, summaryMessageId);

  const contactMessageId = await whatsappClient.sendContactCard(phoneNumberId, from, {
    formattedName: extracted.person_name || extracted.company_name,
    firstName: (extracted.person_name || extracted.company_name).split(" ")[0] ?? "",
    lastName: (extracted.person_name || extracted.company_name).split(" ").slice(1).join(" "),
    company: extracted.company_name,
    title: extracted.job_title,
    email: extracted.primary_email,
    phone: extracted.primary_phone,
    waId: extracted.primary_phone.replace(/\D/g, ""),
    website: extracted.website,
  });
  if (contactMessageId) await registerCardMessageRef(card.id, contactMessageId);

  await whatsappClient.sendButtons(phoneNumberId, from, eventLine + Copy.voiceNotePrompt, [
    { id: Ids.voiceNoteAdd, title: "Add voice note" },
    { id: Ids.voiceNoteScanNext, title: "Scan next card" },
  ]);
}

/** Called once an event has just been set (typed name or picked from the
 * recent-events list) for a user with a photo held on
 * pending_front_media_id — continues into the both-sides-or-finalize
 * branch instead of the caller just confirming the event and stopping.
 * Re-fetches the user since the caller's copy is stale relative to the
 * active_event_id update it just made. */
export async function resumeScanAfterEventSet(phoneNumberId: string, from: string, userId: string): Promise<void> {
  const user = await usersRepo.findById(userId);
  if (!user || !user.pending_front_media_id) return;

  // Both images are already held (the back photo arrived while the event
  // had expired, see stateContinuation.ts's awaiting_back_photo case) —
  // finalize directly instead of asking for a back photo we already have.
  if (user.pending_back_media_id) {
    const [front, back] = await Promise.all([
      whatsappClient.downloadMediaById(user.pending_front_media_id),
      whatsappClient.downloadMediaById(user.pending_back_media_id),
    ]);
    await whatsappClient.sendText(phoneNumberId, from, Copy.processingCard);
    const { card, extracted } = await finalizeScan({
      userId: user.user_id,
      accountId: user.account_id,
      eventId: user.active_event_id!,
      channel: "whatsapp",
      messageId: user.pending_front_media_id,
      frontImageId: user.pending_front_media_id,
      frontImageBuffer: front.buffer,
      frontMimeType: front.mimeType,
      backImageId: user.pending_back_media_id,
      backImageBuffer: back.buffer,
      backMimeType: back.mimeType,
    });
    await sendScanResult(phoneNumberId, from, null, card, extracted, user);
    return;
  }

  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setState(userId, "awaiting_back_photo");
    await whatsappClient.sendText(phoneNumberId, from, Copy.askForBackPhoto);
    return;
  }

  const { buffer, mimeType } = await whatsappClient.downloadMediaById(user.pending_front_media_id);
  await whatsappClient.sendText(phoneNumberId, from, Copy.processingCard);
  const { card, extracted } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "whatsapp",
    messageId: user.pending_front_media_id,
    frontImageId: user.pending_front_media_id,
    frontImageBuffer: buffer,
    frontMimeType: mimeType,
  });

  await sendScanResult(phoneNumberId, from, null, card, extracted, user);
}

async function sendOutOfCoins(phoneNumberId: string, from: string, user: UserWithEvent): Promise<void> {
  const status = await getSubscriptionStatus(user);
  const topUpUrl = await createMagicLoginLink(user.account_id!, "/topup?returnTo=whatsapp");

  if (status.tone === "none" || status.tone === "expired") {
    const subscribeUrl = await createMagicLoginLink(user.account_id!, "/subscribe?returnTo=whatsapp");
    await whatsappClient.sendText(phoneNumberId, from, Copy.outOfCoinsNoPlan(subscribeUrl, topUpUrl));
    return;
  }

  await whatsappClient.sendText(phoneNumberId, from, Copy.outOfCoinsHasPlan(topUpUrl));
}
