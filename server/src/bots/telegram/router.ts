import { normalizeTelegramUpdate } from "../../integrations/telegram/normalize";
import { telegramClient } from "../../integrations/telegram/client";
import { usersRepo } from "../../db/repositories/users.repo";
import { channelLinksRepo } from "../../db/repositories/channelLinks.repo";
import { childLogger } from "../../lib/logger";
import * as channelOnboardingService from "../../services/channelOnboardingService";
import { handlePhoto } from "./handlers/photo";
import { handleVoice } from "./handlers/voice";
import { handleText } from "./handlers/text";
import { handleCallback } from "./handlers/callback";
import { tryContinuePendingState } from "./handlers/stateContinuation";
import { Copy } from "./messages";

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

  // /start <code> is how dashboard-initiated Telegram linking (Profile →
  // Channels, e.g. linking Telegram as a second channel) always arrives —
  // it must always reach handleText's resolveTelegramLinkCode below, even
  // from a brand-new, still-unlinked Telegram identity. Everything else
  // from an unlinked identity gets held for the gate right after.
  const isLinkCodeRedemption = message.type === "text" && /^\/start\s+\S+$/.test(message.text?.trim() ?? "");

  if (!isLinkCodeRedemption) {
    // Not yet linked to a dashboard account — hold off on everything else
    // and push them toward signup instead. Applies to every message, not
    // just the first, per product decision: no scanning until they link.
    const link = await channelLinksRepo.findByUsersId(user.user_id);
    if (!link) {
      const onboardingUrl = await channelOnboardingService.createOnboardingLink("telegram", user.telegram_id ?? message.telegramUserId);
      await telegramClient.sendMessage(message.chatId, Copy.channelOnboardingPrompt(onboardingUrl));
      return;
    }
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
