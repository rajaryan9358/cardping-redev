export type NormalizedTelegramMessageType =
  | "text"
  | "photo"
  | "voice"
  | "callback_button"
  | "unknown";

export interface NormalizedTelegramMessage {
  type: NormalizedTelegramMessageType;
  telegramUserId: string;
  chatId: string;
  messageId: number | null;
  /** message.reply_to_message.message_id — used the same way as WhatsApp's
   * context.id, to match a voice note reply back to a card. */
  replyToMessageId: number | null;
  text: string | null;
  /** file_id of the highest-resolution photo, if any. */
  photoFileId: string | null;
  voiceFileId: string | null;
  /** data payload of a tapped inline-keyboard button. */
  callbackData: string | null;
  callbackQueryId: string | null;
  firstName: string | null;
}

export interface InlineButton {
  text: string;
  data: string;
}
