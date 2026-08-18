import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { hasEnoughCoinsForScan, chargeForCardScan } from "../../../services/coinService";
import { processCardImage, linkCardToInboundMessage } from "../../../services/cardService";
import { prepareFollowUpDraft } from "../../../services/emailFollowUpService";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { childLogger } from "../../../lib/logger";
import { Copy, formatCardSummary } from "../messages";
import { Ids } from "../ids";

const log = childLogger("wa-image-handler");

export async function handleImage(msg: NormalizedWhatsAppMessage, user: UserWithEvent): Promise<void> {
  const { phoneNumberId, from } = msg;

  if (user.blocked_at) {
    await whatsappClient.sendText(phoneNumberId, from, Copy.accountBlocked);
    return;
  }

  if (!hasEnoughCoinsForScan(user.coin_balance)) {
    await whatsappClient.sendText(phoneNumberId, from, Copy.insufficientCoins(user.coin_balance));
    return;
  }

  if (!user.active_event_id) {
    await usersRepo.setState(user.user_id, "awaiting_event_name");
    await whatsappClient.sendText(phoneNumberId, from, Copy.needEventFirst);
    return;
  }

  if (!msg.mediaId) {
    log.warn({ from }, "image message had no media id");
    return;
  }

  const { buffer, mimeType } = await whatsappClient.downloadMediaById(msg.mediaId);

  const { card, extracted } = await processCardImage({
    userId: user.user_id,
    eventId: user.active_event_id,
    uploadedBy: "whatsapp",
    imageId: msg.mediaId,
    imageBuffer: buffer,
    mimeType,
  });

  await Promise.all([
    linkCardToInboundMessage(card.id, msg.waMessageId),
    usersRepo.setActiveVisitingCard(user.user_id, card.id),
    chargeForCardScan(user.user_id),
  ]);

  await whatsappClient.sendText(phoneNumberId, from, formatCardSummary(extracted), {
    replyToMessageId: msg.waMessageId,
  });

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

  if (!isGmailFollowUpEnabled) return;

  const draft = await prepareFollowUpDraft(
    { fullName: user.full_name, email: user.email },
    card,
    extracted,
    user.active_event_name,
    null,
  );

  if (!draft) return;

  await usersRepo.setState(user.user_id, "awaiting_email_review");
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
