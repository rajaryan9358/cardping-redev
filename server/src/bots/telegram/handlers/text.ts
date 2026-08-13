import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy, sendMainMenu } from "../messages";
import { Ids } from "../ids";

export async function handleText(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId, text } = msg;

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
    await sendMainMenu(chatId, `Hi${name} 👋 What would you like to do?`);
    return;
  }

  await sendMainMenu(chatId, "Not sure how to handle that — here's what I can do:");
}
