import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { ExtractedCard, TempEmail, UserWithEvent, VisitingCard } from "../../../types/domain";
import { hasEnoughCoinsForScan } from "../../../services/coinService";
import { decideScanAction, finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { Copy, formatCardSummary, sendEventPicker } from "../messages";
import { Ids } from "../ids";

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
  const { card, extracted, draft } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "telegram",
    messageId: String(msg.messageId),
    frontImageId: msg.photoFileId,
    frontImageBuffer: buffer,
    frontMimeType: "image/jpeg",
    requester: { fullName: user.full_name, email: user.email },
    activeEventName: user.active_event_name,
  });

  await sendScanResult(chatId, msg.messageId ?? undefined, card, extracted, draft);
}

/** Renders the result of a finalized scan — reused by handlePhoto's
 * immediate path and stateContinuation.ts's resumed-after-event/back-photo
 * paths, so the two never drift. */
export async function sendScanResult(
  chatId: string,
  replyToMessageId: number | undefined,
  card: VisitingCard,
  extracted: ExtractedCard,
  draft: TempEmail | null,
): Promise<void> {
  await telegramClient.sendMessage(chatId, formatCardSummary(extracted), {
    replyToMessageId: replyToMessageId ?? undefined,
  });
  await telegramClient.sendMessage(chatId, Copy.voiceNoteHint);

  if (!isGmailFollowUpEnabled || !draft) return;

  await telegramClient.sendMessage(chatId, Copy.emailReviewPrompt(draft.subject ?? "", draft.body ?? ""), {
    buttons: [
      { text: "Save to Gmail", data: Ids.emailReviewApprove },
      { text: "Skip", data: Ids.emailReviewChange },
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

  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setState(userId, "awaiting_back_photo");
    await telegramClient.sendMessage(chatId, Copy.askForBackPhoto);
    return;
  }

  const buffer = await telegramClient.downloadFileById(user.pending_front_media_id);
  const { card, extracted, draft } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "telegram",
    messageId: user.pending_front_media_id,
    frontImageId: user.pending_front_media_id,
    frontImageBuffer: buffer,
    frontMimeType: "image/jpeg",
    requester: { fullName: user.full_name, email: user.email },
    activeEventName: user.active_event_name,
  });

  await sendScanResult(chatId, undefined, card, extracted, draft);
}

async function sendOutOfCoins(chatId: string, user: UserWithEvent): Promise<void> {
  const status = await getSubscriptionStatus(user);
  const topUpUrl = await createMagicLoginLink(user.account_id!, "/subscription/topup");

  if (status.tone === "none" || status.tone === "expired") {
    const subscribeUrl = await createMagicLoginLink(user.account_id!, "/subscription");
    await telegramClient.sendMessage(chatId, Copy.outOfCoinsNoPlan(subscribeUrl, topUpUrl));
    return;
  }

  await telegramClient.sendMessage(chatId, Copy.outOfCoinsHasPlan(topUpUrl));
}
