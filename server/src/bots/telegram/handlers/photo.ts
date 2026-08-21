import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
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

const log = childLogger("tg-photo-handler");

export async function handlePhoto(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId } = msg;

  if (user.effective_blocked_at) {
    await telegramClient.sendMessage(chatId, Copy.accountBlocked);
    return;
  }

  if (!hasEnoughCoinsForScan(user.effective_coin_balance)) {
    await sendOutOfCoins(chatId, user);
    return;
  }

  if (!msg.photoFileId) return;

  const action = decideScanAction(user);

  if (action === "ask_event") {
    await usersRepo.setPendingMedia(user.user_id, msg.photoFileId, null);
    await usersRepo.setState(user.user_id, "awaiting_event_choice");
    await sendEventPicker(chatId, user.user_id);
    return;
  }

  // An active event exists, so we're clear to batch — hold this photo for
  // a short window to see if a second one (front+back, sent together)
  // follows, instead of committing to a single-image scan immediately.
  addToBatch(user.user_id, { mediaId: msg.photoFileId, messageId: String(msg.messageId) }, (outcome) => {
    handleBatchOutcome(chatId, user, outcome).catch((err) => {
      log.error({ err, chatId }, "failed to process batched image outcome");
    });
  });
}

/** Runs once the batch window closes — see imageBatchBuffer.ts. One photo
 * behaves like before (ask for the back, or finalize, depending on the
 * scan_both_sides preference); two are always treated as front+back since
 * sending them together is unambiguous; three or more are rejected outright
 * rather than guessed at. */
async function handleBatchOutcome(chatId: string, user: UserWithEvent, outcome: BatchOutcome): Promise<void> {
  if (outcome.kind === "too_many") {
    await telegramClient.sendMessage(chatId, Copy.tooManyImages);
    return;
  }

  if (outcome.kind === "pair") {
    const [frontBuffer, backBuffer] = await Promise.all([
      telegramClient.downloadFileById(outcome.front.mediaId),
      telegramClient.downloadFileById(outcome.back.mediaId),
    ]);
    await telegramClient.sendMessage(chatId, Copy.processingCard);
    const { card, extracted } = await finalizeScan({
      userId: user.user_id,
      accountId: user.account_id,
      eventId: user.active_event_id!,
      channel: "telegram",
      messageId: outcome.back.messageId,
      frontImageId: outcome.front.mediaId,
      frontImageBuffer: frontBuffer,
      frontMimeType: "image/jpeg",
      backImageId: outcome.back.mediaId,
      backImageBuffer: backBuffer,
      backMimeType: "image/jpeg",
    });
    await registerCardMessageRef(card.id, outcome.front.messageId);
    await sendScanResult(chatId, Number(outcome.back.messageId), card, extracted, user);
    return;
  }

  // Single image — same decision the old immediate path made.
  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setPendingMedia(user.user_id, outcome.image.mediaId, null);
    await usersRepo.setState(user.user_id, "awaiting_back_photo");
    await telegramClient.sendMessage(chatId, Copy.askForBackPhoto);
    return;
  }

  const buffer = await telegramClient.downloadFileById(outcome.image.mediaId);
  await telegramClient.sendMessage(chatId, Copy.processingCard);
  const { card, extracted } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "telegram",
    messageId: outcome.image.messageId,
    frontImageId: outcome.image.mediaId,
    frontImageBuffer: buffer,
    frontMimeType: "image/jpeg",
  });

  await sendScanResult(chatId, Number(outcome.image.messageId), card, extracted, user);
}

/** Renders the result of a finalized scan — reused by handlePhoto's
 * immediate path and stateContinuation.ts's resumed-after-event/back-photo
 * paths, so the two never drift. Also registers the summary message as a
 * voice-note reply anchor, alongside the front/back photo already
 * registered by finalizeScan/the back-photo handler. */
export async function sendScanResult(
  chatId: string,
  replyToMessageId: number | undefined,
  card: VisitingCard,
  extracted: ExtractedCard,
  user: UserWithEvent,
): Promise<void> {
  const remaining = formatEventLifetimeRemaining(user.active_event_set_at, user.event_lifetime_hours);
  const eventLine = user.active_event_name ? `📁 Added to <b>${user.active_event_name}</b> — ${remaining}\n\n` : "";

  const summaryMessageId = await telegramClient.sendMessage(chatId, formatCardSummary(extracted), {
    replyToMessageId,
  });
  await registerCardMessageRef(card.id, String(summaryMessageId));

  await telegramClient.sendMessage(chatId, eventLine + Copy.voiceNotePrompt, {
    buttons: [
      { text: "🎙️ Add voice note", data: Ids.voiceNoteAdd },
      { text: "📇 Scan next card", data: Ids.voiceNoteScanNext },
    ],
  });
}

/** Called once an event has just been set (typed name or picked from the
 * recent-events list) for a user with a photo held on
 * pending_front_media_id — continues into the both-sides-or-finalize
 * branch instead of the caller just confirming the event and stopping.
 * Re-fetches the user since the caller's copy is stale relative to the
 * active_event_id update it just made. */
export async function resumeScanAfterEventSet(chatId: string, userId: string): Promise<void> {
  const user = await usersRepo.findById(userId);
  if (!user || !user.pending_front_media_id) return;

  // Both images are already held (the back photo arrived while the event
  // had expired, see stateContinuation.ts's awaiting_back_photo case) —
  // finalize directly instead of asking for a back photo we already have.
  if (user.pending_back_media_id) {
    const [frontBuffer, backBuffer] = await Promise.all([
      telegramClient.downloadFileById(user.pending_front_media_id),
      telegramClient.downloadFileById(user.pending_back_media_id),
    ]);
    await telegramClient.sendMessage(chatId, Copy.processingCard);
    const { card, extracted } = await finalizeScan({
      userId: user.user_id,
      accountId: user.account_id,
      eventId: user.active_event_id!,
      channel: "telegram",
      messageId: user.pending_front_media_id,
      frontImageId: user.pending_front_media_id,
      frontImageBuffer: frontBuffer,
      frontMimeType: "image/jpeg",
      backImageId: user.pending_back_media_id,
      backImageBuffer: backBuffer,
      backMimeType: "image/jpeg",
    });
    await sendScanResult(chatId, undefined, card, extracted, user);
    return;
  }

  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setState(userId, "awaiting_back_photo");
    await telegramClient.sendMessage(chatId, Copy.askForBackPhoto);
    return;
  }

  const buffer = await telegramClient.downloadFileById(user.pending_front_media_id);
  await telegramClient.sendMessage(chatId, Copy.processingCard);
  const { card, extracted } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "telegram",
    messageId: user.pending_front_media_id,
    frontImageId: user.pending_front_media_id,
    frontImageBuffer: buffer,
    frontMimeType: "image/jpeg",
  });

  await sendScanResult(chatId, undefined, card, extracted, user);
}

async function sendOutOfCoins(chatId: string, user: UserWithEvent): Promise<void> {
  const status = await getSubscriptionStatus(user);
  const topUpUrl = await createMagicLoginLink(user.account_id!, "/topup?returnTo=telegram");

  if (status.tone === "none" || status.tone === "expired") {
    const subscribeUrl = await createMagicLoginLink(user.account_id!, "/subscribe?returnTo=telegram");
    await telegramClient.sendMessage(chatId, Copy.outOfCoinsNoPlan(subscribeUrl, topUpUrl));
    return;
  }

  await telegramClient.sendMessage(chatId, Copy.outOfCoinsHasPlan(topUpUrl));
}
