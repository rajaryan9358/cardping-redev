import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { ExtractedCard, UserWithEvent, VisitingCard } from "../../../types/domain";
import { hasEnoughCoinsForScan } from "../../../services/coinService";
import { decideScanAction, finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { formatEventLifetimeRemaining } from "../../../services/eventService";
import { Copy, formatCardSummary, sendEventPicker } from "../messages";

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

  if (action === "ask_back_photo") {
    await usersRepo.setPendingMedia(user.user_id, msg.photoFileId, null);
    await usersRepo.setState(user.user_id, "awaiting_back_photo");
    await telegramClient.sendMessage(chatId, Copy.askForBackPhoto);
    return;
  }

  const buffer = await telegramClient.downloadFileById(msg.photoFileId);
  await telegramClient.sendMessage(chatId, Copy.processingCard);
  const { card, extracted } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "telegram",
    messageId: String(msg.messageId),
    frontImageId: msg.photoFileId,
    frontImageBuffer: buffer,
    frontMimeType: "image/jpeg",
  });

  await sendScanResult(chatId, msg.messageId ?? undefined, card, extracted, user);
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

  const summaryMessageId = await telegramClient.sendMessage(chatId, eventLine + formatCardSummary(extracted), {
    replyToMessageId,
  });
  await registerCardMessageRef(card.id, String(summaryMessageId));

  const hintMessageId = await telegramClient.sendMessage(chatId, Copy.voiceNoteHint);
  await registerCardMessageRef(card.id, String(hintMessageId));
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
