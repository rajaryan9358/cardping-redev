import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { ExtractedCard, TempEmail, UserWithEvent, VisitingCard } from "../../../types/domain";
import { hasEnoughCoinsForScan } from "../../../services/coinService";
import { decideScanAction, finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { isGmailFollowUpEnabled } from "../../../config/env";
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

  if (action === "ask_back_photo") {
    await usersRepo.setPendingMedia(user.user_id, msg.mediaId, null);
    await usersRepo.setState(user.user_id, "awaiting_back_photo");
    await whatsappClient.sendText(phoneNumberId, from, Copy.askForBackPhoto);
    return;
  }

  const { buffer, mimeType } = await whatsappClient.downloadMediaById(msg.mediaId);
  const { card, extracted, draft } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "whatsapp",
    messageId: msg.waMessageId,
    frontImageId: msg.mediaId,
    frontImageBuffer: buffer,
    frontMimeType: mimeType,
    requester: { fullName: user.full_name, email: user.email },
    activeEventName: user.active_event_name,
  });

  await sendScanResult(phoneNumberId, from, msg.waMessageId, card, extracted, draft);
}

/** Renders the result of a finalized scan — reused by handleImage's
 * immediate path (has a real inbound message to thread the summary under)
 * and stateContinuation.ts's resumed-after-event/back-photo paths (no
 * natural message to reply to, so replyToMessageId is null there). */
export async function sendScanResult(
  phoneNumberId: string,
  from: string,
  replyToMessageId: string | null,
  card: VisitingCard,
  extracted: ExtractedCard,
  draft: TempEmail | null,
): Promise<void> {
  await whatsappClient.sendText(
    phoneNumberId,
    from,
    formatCardSummary(extracted),
    replyToMessageId ? { replyToMessageId } : {},
  );

  await whatsappClient.sendContactCard(phoneNumberId, from, {
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

  await whatsappClient.sendText(phoneNumberId, from, Copy.voiceNoteHint);

  if (!isGmailFollowUpEnabled || !draft) return;

  await whatsappClient.sendButtons(
    phoneNumberId,
    from,
    Copy.emailReviewPrompt(draft.subject ?? "", draft.body ?? ""),
    [
      { id: Ids.emailReviewApprove, title: "Save to Gmail" },
      { id: Ids.emailReviewChange, title: "Skip" },
    ],
  );
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

  if (decideScanAction(user) === "ask_back_photo") {
    await usersRepo.setState(userId, "awaiting_back_photo");
    await whatsappClient.sendText(phoneNumberId, from, Copy.askForBackPhoto);
    return;
  }

  const { buffer, mimeType } = await whatsappClient.downloadMediaById(user.pending_front_media_id);
  const { card, extracted, draft } = await finalizeScan({
    userId: user.user_id,
    accountId: user.account_id,
    eventId: user.active_event_id!,
    channel: "whatsapp",
    messageId: user.pending_front_media_id,
    frontImageId: user.pending_front_media_id,
    frontImageBuffer: buffer,
    frontMimeType: mimeType,
    requester: { fullName: user.full_name, email: user.email },
    activeEventName: user.active_event_name,
  });

  await sendScanResult(phoneNumberId, from, null, card, extracted, draft);
}

async function sendOutOfCoins(phoneNumberId: string, from: string, user: UserWithEvent): Promise<void> {
  const status = await getSubscriptionStatus(user);
  const topUpUrl = await createMagicLoginLink(user.account_id!, "/subscription/topup");

  if (status.tone === "none" || status.tone === "expired") {
    const subscribeUrl = await createMagicLoginLink(user.account_id!, "/subscription");
    await whatsappClient.sendText(phoneNumberId, from, Copy.outOfCoinsNoPlan(subscribeUrl, topUpUrl));
    return;
  }

  await whatsappClient.sendText(phoneNumberId, from, Copy.outOfCoinsHasPlan(topUpUrl));
}
