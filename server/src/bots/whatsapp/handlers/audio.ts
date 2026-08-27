import { whatsappClient } from "../../../integrations/whatsapp/client";
import { visitingCardsRepo } from "../../../db/repositories/visitingCards.repo";
import { attachVoiceNoteToCard } from "../../../services/voiceNoteService";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";

export async function handleAudio(msg: NormalizedWhatsAppMessage, user: UserWithEvent): Promise<void> {
  const { phoneNumberId, from } = msg;

  const card = msg.contextMessageId
    ? await visitingCardsRepo.findByMessageId(msg.contextMessageId)
    : null;

  if (!card || !msg.mediaId) {
    await whatsappClient.sendText(phoneNumberId, from, Copy.voiceNoteMustReplyToCard);
    return;
  }

  const { buffer } = await whatsappClient.downloadMediaById(msg.mediaId);
  await attachVoiceNoteToCard(user.user_id, card, buffer);

  // Registered as a reply anchor too — a user can keep adding more voice
  // notes by replying to this confirmation, not just the original photo/
  // summary/contact card.
  const confirmMessageId = await whatsappClient.sendText(phoneNumberId, from, Copy.voiceNoteSaved);
  if (confirmMessageId) await registerCardMessageRef(card.id, confirmMessageId);
}
