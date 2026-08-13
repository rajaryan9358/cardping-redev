import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { createTopUpLink } from "../../../services/paymentService";
import { isCashfreeEnabled } from "../../../config/env";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";
import { Ids } from "../ids";

export async function handleCallback(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId } = msg;

  switch (msg.callbackData) {
    case Ids.menuScan:
      await telegramClient.sendMessage(chatId, Copy.askForPhoto);
      return;

    case Ids.menuSetEvent:
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

    case Ids.eventChangeYes:
      await usersRepo.setState(user.user_id, "awaiting_event_name");
      await telegramClient.sendMessage(chatId, Copy.askNewEventName);
      return;

    case Ids.eventChangeNo:
      await telegramClient.sendMessage(chatId, Copy.keepingCurrentEvent(user.active_event_name ?? ""));
      return;

    case Ids.menuBuyCredits:
      if (!isCashfreeEnabled) {
        await telegramClient.sendMessage(chatId, "Coin top-ups aren't configured on this server yet.");
        return;
      }
      if (user.wa_id) {
        // Already have a phone number on file (e.g. this person also uses
        // the WhatsApp bot) — skip straight to generating the link.
        const linkUrl = await createTopUpLink(user.user_id, user.wa_id);
        await telegramClient.sendMessage(chatId, Copy.paymentLink(linkUrl));
        return;
      }
      await usersRepo.setState(user.user_id, "awaiting_topup_phone");
      await telegramClient.sendMessage(
        chatId,
        "What phone number (with country code) should the payment confirmation go to?",
      );
      return;

    case Ids.menuAccount:
      await usersRepo.setState(user.user_id, "awaiting_account_settings_choice");
      await telegramClient.sendMessage(chatId, Copy.accountSettingsPrompt, {
        buttons: [
          { text: "Connect Gmail", data: Ids.accountConnectGmail },
          { text: "Check Credit", data: Ids.accountCheckCredit },
        ],
      });
      return;

    default:
      await telegramClient.sendMessage(chatId, "Let's start over — send /menu to see what I can do.");
      return;
  }
}
