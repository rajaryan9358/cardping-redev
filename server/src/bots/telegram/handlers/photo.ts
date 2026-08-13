import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { hasEnoughCoinsForScan, chargeForCardScan } from "../../../services/coinService";
import { processCardImage, linkCardToInboundMessage } from "../../../services/cardService";
import { prepareFollowUpDraft } from "../../../services/emailFollowUpService";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { Copy, formatCardSummary } from "../messages";
import { Ids } from "../ids";

export async function handlePhoto(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId } = msg;

  if (!hasEnoughCoinsForScan(user.coin_balance)) {
    await telegramClient.sendMessage(chatId, Copy.insufficientCoins(user.coin_balance));
    return;
  }

  if (!user.active_event_id) {
    await usersRepo.setState(user.user_id, "awaiting_event_name");
    await telegramClient.sendMessage(chatId, Copy.needEventFirst);
    return;
  }

  if (!msg.photoFileId) return;

  const buffer = await telegramClient.downloadFileById(msg.photoFileId);

  const { card, extracted } = await processCardImage({
    userId: user.user_id,
    eventId: user.active_event_id,
    uploadedBy: "telegram",
    imageId: msg.photoFileId,
    imageBuffer: buffer,
    mimeType: "image/jpeg",
  });

  const messageIdStr = String(msg.messageId);
  await Promise.all([
    linkCardToInboundMessage(card.id, messageIdStr),
    usersRepo.setActiveVisitingCard(user.user_id, card.id),
    chargeForCardScan(user.user_id),
  ]);

  await telegramClient.sendMessage(chatId, formatCardSummary(extracted), {
    replyToMessageId: msg.messageId ?? undefined,
  });
  await telegramClient.sendMessage(chatId, Copy.voiceNoteHint);

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
  await telegramClient.sendMessage(chatId, Copy.emailReviewPrompt(draft.subject ?? "", draft.body ?? ""), {
    buttons: [
      { text: "Save to Gmail", data: Ids.emailReviewApprove },
      { text: "Skip", data: Ids.emailReviewChange },
    ],
  });
}
