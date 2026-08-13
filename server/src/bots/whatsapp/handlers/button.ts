import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { createTopUpLink } from "../../../services/paymentService";
import { isCashfreeEnabled } from "../../../config/env";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";
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
      await usersRepo.setState(user.user_id, "awaiting_event_name");
      await whatsappClient.sendText(phoneNumberId, from, Copy.askNewEventName);
      return;

    case Ids.eventChangeYes:
      await usersRepo.setState(user.user_id, "awaiting_event_name");
      await whatsappClient.sendText(phoneNumberId, from, Copy.askNewEventName);
      return;

    case Ids.eventChangeNo:
      await whatsappClient.sendText(
        phoneNumberId,
        from,
        Copy.keepingCurrentEvent(user.active_event_name ?? ""),
      );
      return;

    case Ids.menuBuyCredits:
      if (!isCashfreeEnabled) {
        await whatsappClient.sendText(
          phoneNumberId,
          from,
          "Coin top-ups aren't configured on this server yet.",
        );
        return;
      }
      {
        const linkUrl = await createTopUpLink(user.user_id, from);
        await whatsappClient.sendText(phoneNumberId, from, Copy.paymentLink(linkUrl));
      }
      return;

    case Ids.menuAccount:
      await usersRepo.setState(user.user_id, "awaiting_account_settings_choice");
      await whatsappClient.sendButtons(phoneNumberId, from, Copy.accountSettingsPrompt, [
        { id: Ids.accountConnectGmail, title: "Connect Gmail" },
        { id: Ids.accountCheckCredit, title: "Check Credit" },
      ]);
      return;

    default:
      // Stale button tap (e.g. from an old menu the user scrolled back to)
      // — just re-show the menu instead of staying silent.
      await whatsappClient.sendText(phoneNumberId, from, "Let's start over — here's what I can do:");
      return;
  }
}
