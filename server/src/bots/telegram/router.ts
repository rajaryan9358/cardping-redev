import { normalizeTelegramUpdate } from "../../integrations/telegram/normalize";
import { telegramClient } from "../../integrations/telegram/client";
import { usersRepo } from "../../db/repositories/users.repo";
import { childLogger } from "../../lib/logger";
import { handlePhoto } from "./handlers/photo";
import { handleVoice } from "./handlers/voice";
import { handleText } from "./handlers/text";
import { handleCallback } from "./handlers/callback";
import { tryContinuePendingState } from "./handlers/stateContinuation";

const log = childLogger("tg-router");

/** Entry point called by routes/telegramWebhook.route.ts for every inbound
 * Telegram update. Runs after the HTTP response has already been sent to
 * Telegram, so errors here are logged rather than surfaced to the caller. */
export async function routeTelegramUpdate(update: unknown): Promise<void> {
  const message = normalizeTelegramUpdate(update);
  if (!message) return;

  const user = await usersRepo.findOrCreate(
    "telegram",
    message.telegramUserId,
    message.chatId,
    message.firstName,
  );

  // Acknowledge the button tap immediately so Telegram stops showing the
  // loading spinner on it, regardless of how long the rest takes.
  if (message.callbackQueryId) {
    await telegramClient.answerCallbackQuery(message.callbackQueryId);
  }

  if (user.user_state && user.user_state !== "idle") {
    const consumed = await tryContinuePendingState(message, user);
    if (consumed) return;
  }

  switch (message.type) {
    case "photo":
      await handlePhoto(message, user);
      return;
    case "voice":
      await handleVoice(message, user);
      return;
    case "callback_button":
      await handleCallback(message, user);
      return;
    case "text":
      await handleText(message, user);
      return;
    default:
      log.info({ type: message.type, telegramUserId: message.telegramUserId }, "unhandled Telegram message type");
  }
}
