import { telegramClient } from "../../../integrations/telegram/client";
import { visitingCardsRepo } from "../../../db/repositories/visitingCards.repo";
import { attachVoiceNoteToCard } from "../../../services/voiceNoteService";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";

export async function handleVoice(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId } = msg;

  const card = msg.replyToMessageId
    ? await visitingCardsRepo.findByMessageId(String(msg.replyToMessageId))
    : null;

  if (!card || !msg.voiceFileId) {
    await telegramClient.sendMessage(chatId, Copy.voiceNoteMustReplyToCard);
    return;
  }

  const buffer = await telegramClient.downloadFileById(msg.voiceFileId);
  await attachVoiceNoteToCard(user.user_id, card, buffer);

  // Registered as a reply anchor too — a user can keep adding more voice
  // notes by replying to this confirmation, not just the original photo/
  // summary/contact card.
  const confirmMessageId = await telegramClient.sendMessage(chatId, Copy.voiceNoteSaved);
  await registerCardMessageRef(card.id, String(confirmMessageId));
}
