import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { effectiveActiveEventName } from "../../../services/eventService";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy, sendAccountSettingsMenu, sendEventPicker } from "../messages";
import { Ids } from "../ids";

export async function handleCallback(msg: NormalizedTelegramMessage, user: UserWithEvent): Promise<void> {
  const { chatId } = msg;

  switch (msg.callbackData) {
    case Ids.menuScan:
      await telegramClient.sendMessage(chatId, Copy.askForPhoto);
      return;

    case Ids.menuSetEvent: {
      const activeEventName = effectiveActiveEventName(user);
      if (activeEventName) {
        await telegramClient.sendMessage(
          chatId,
          Copy.currentEventChangePrompt(activeEventName, user.active_event_set_at, user.event_lifetime_hours),
          {
            buttons: [
              { text: "Change it", data: Ids.eventChangeYes },
              { text: "Keep it", data: Ids.eventChangeNo },
            ],
          },
        );
        return;
      }
      await usersRepo.setState(user.user_id, "awaiting_event_choice");
      await sendEventPicker(chatId, user.user_id);
      return;
    }

    case Ids.eventChangeYes:
      await usersRepo.setState(user.user_id, "awaiting_event_choice");
      await sendEventPicker(chatId, user.user_id);
      return;

    case Ids.eventChangeNo:
      await telegramClient.sendMessage(chatId, Copy.keepingCurrentEvent(effectiveActiveEventName(user) ?? ""));
      return;

    case Ids.menuBuyCredits: {
      const linkUrl = await createMagicLoginLink(user.account_id!, "/topup?returnTo=telegram");
      await telegramClient.sendMessage(chatId, Copy.buyCreditsLink(linkUrl));
      return;
    }

    case Ids.menuAccount: {
      await usersRepo.setState(user.user_id, "awaiting_account_settings_choice");
      const status = await getSubscriptionStatus(user);
      await sendAccountSettingsMenu(chatId, status, Boolean(user.scan_both_sides), user.event_lifetime_hours);
      return;
    }

    case Ids.menuViewDashboard: {
      const linkUrl = await createMagicLoginLink(user.account_id!, "/home");
      await telegramClient.sendMessage(chatId, Copy.viewDashboardLink(linkUrl));
      return;
    }

    default:
      await telegramClient.sendMessage(chatId, "Let's start over — send /menu to see what I can do.");
      return;
  }
}
