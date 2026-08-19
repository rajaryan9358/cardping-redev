import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy, sendAccountSettingsMenu, sendEventPicker } from "../messages";
import { Ids } from "../ids";

export async function handleButton(msg: NormalizedWhatsAppMessage, user: UserWithEvent): Promise<void> {
  const { phoneNumberId, from } = msg;

  switch (msg.buttonId) {
    case Ids.menuScan:
      await whatsappClient.sendText(phoneNumberId, from, Copy.askForPhoto);
      return;

    case Ids.menuSetEvent:
      if (user.active_event_name) {
        await whatsappClient.sendButtons(
          phoneNumberId,
          from,
          Copy.currentEventChangePrompt(user.active_event_name),
          [
            { id: Ids.eventChangeYes, title: "Change it" },
            { id: Ids.eventChangeNo, title: "Keep it" },
          ],
        );
        return;
      }
      await usersRepo.setState(user.user_id, "awaiting_event_choice");
      await sendEventPicker(phoneNumberId, from, user.user_id);
      return;

    case Ids.eventChangeYes:
      await usersRepo.setState(user.user_id, "awaiting_event_choice");
      await sendEventPicker(phoneNumberId, from, user.user_id);
      return;

    case Ids.eventChangeNo:
      await whatsappClient.sendText(
        phoneNumberId,
        from,
        Copy.keepingCurrentEvent(user.active_event_name ?? ""),
      );
      return;

    case Ids.menuBuyCredits: {
      const linkUrl = await createMagicLoginLink(user.account_id!, "/subscription/topup");
      await whatsappClient.sendText(phoneNumberId, from, Copy.buyCreditsLink(linkUrl));
      return;
    }

    case Ids.menuAccount: {
      await usersRepo.setState(user.user_id, "awaiting_account_settings_choice");
      const status = await getSubscriptionStatus(user);
      await sendAccountSettingsMenu(phoneNumberId, from, status, Boolean(user.scan_both_sides), user.event_lifetime_hours);
      return;
    }

    default:
      // Stale button tap (e.g. from an old menu the user scrolled back to)
      // — just re-show the menu instead of staying silent.
      await whatsappClient.sendText(phoneNumberId, from, "Let's start over — here's what I can do:");
      return;
  }
}
