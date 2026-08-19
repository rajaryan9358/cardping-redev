import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import * as channelLinkService from "../../../services/channelLinkService";
import { Copy, sendMainMenu } from "../messages";
import { Ids } from "../ids";

export async function handleText(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId, text } = msg;

  // dashboard/'s "Connect Telegram" flow sends the user to
  // t.me/<bot>?start=<code> — Telegram turns that into a plain "/start
  // <code>" text message on the bot's end. Bare "/start" (no payload)
  // falls through to the normal main-menu handling below.
  const startMatch = text?.trim().match(/^\/start\s+(\S+)$/);
  if (startMatch) {
    const accountId = await channelLinkService.resolveTelegramLinkCode(startMatch[1]);
    if (!accountId) {
      await telegramClient.sendMessage(chatId, Copy.channelLinkCodeInvalid);
      return;
    }
    try {
      await channelLinkService.linkChannel(
        accountId,
        user.user_id,
        "telegram",
        user.telegram_id ?? "",
        user.coin_balance,
      );
      await telegramClient.sendMessage(chatId, Copy.channelLinkConfirmed);
    } catch (err: any) {
      if (err?.code === "23505") {
        await telegramClient.sendMessage(chatId, Copy.channelLinkAlreadyLinked);
        return;
      }
      throw err;
    }
    return;
  }

  if (text?.trim() === "/setevent") {
    if (user.active_event_name) {
      await telegramClient.sendMessage(chatId, Copy.currentEventChangePrompt(user.active_event_name), {
        buttons: [
          { text: "Change it", data: Ids.eventChangeYes },
          { text: "Keep it", data: Ids.eventChangeNo },
        ],
      });
      return;
    }
    await usersRepo.setState(user.user_id, "awaiting_event_name");
    await telegramClient.sendMessage(chatId, Copy.askNewEventName);
    return;
  }

  if (text?.trim() === "/start" || text?.trim() === "/menu") {
    const name = user.full_name ? `, ${user.full_name.split(" ")[0]}` : "";
    await sendMainMenu(chatId, `Hi${name} 👋 What would you like to do?`, user.active_event_name);
    return;
  }

  await sendMainMenu(chatId, "Not sure how to handle that — here's what I can do:", user.active_event_name);
}
