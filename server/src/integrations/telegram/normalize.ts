import { NormalizedTelegramMessage } from "./types";

/** Reduces a raw Telegram Bot API update into the handful of fields the
 * bot logic needs, regardless of whether it was a text/photo/voice message
 * or an inline-keyboard button tap. */
export function normalizeTelegramUpdate(update: any): NormalizedTelegramMessage | null {
  if (update.callback_query) {
    const cq = update.callback_query;
    return {
      type: "callback_button",
      telegramUserId: String(cq.from.id),
      chatId: String(cq.message?.chat?.id ?? cq.from.id),
      messageId: cq.message?.message_id ?? null,
      replyToMessageId: null,
      text: null,
      photoFileId: null,
      voiceFileId: null,
      callbackData: cq.data ?? null,
      callbackQueryId: cq.id,
      firstName: cq.from.first_name ?? null,
    };
  }

  const message = update.message;
  if (!message) return null;

  const base = {
    telegramUserId: String(message.from.id),
    chatId: String(message.chat.id),
    messageId: message.message_id as number,
    replyToMessageId: (message.reply_to_message?.message_id as number | undefined) ?? null,
    callbackData: null,
    callbackQueryId: null,
    firstName: (message.from.first_name as string | undefined) ?? null,
  };

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    // Telegram sends the same photo at several resolutions; the last entry
    // is the largest.
    const largest = message.photo[message.photo.length - 1];
    return { ...base, type: "photo", text: null, photoFileId: largest.file_id, voiceFileId: null };
  }

  if (message.voice?.file_id) {
    return {
      ...base,
      type: "voice",
      text: null,
      photoFileId: null,
      voiceFileId: message.voice.file_id,
    };
  }

  if (typeof message.text === "string") {
    return { ...base, type: "text", text: message.text, photoFileId: null, voiceFileId: null };
  }

  return { ...base, type: "unknown", text: null, photoFileId: null, voiceFileId: null };
}
