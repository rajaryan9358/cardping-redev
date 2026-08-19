import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { setActiveEvent } from "../../../services/eventService";
import { sendApprovedDraft, GmailNotConnectedError } from "../../../services/emailFollowUpService";
import { buildGoogleAuthUrl } from "../../../integrations/gmail/oauth";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";
import { Ids } from "../ids";

/** Continues a conversation the bot is mid-way through (the equivalent of
 * an n8n "wait for response" node, but implemented as explicit state on
 * `users.user_state` since this server has no long-running execution to
 * pause). Returns true if it consumed the message. */
export async function tryContinuePendingState(
  msg: NormalizedWhatsAppMessage,
  user: UserWithEvent,
): Promise<boolean> {
  const { phoneNumberId, from } = msg;

  switch (user.user_state) {
    case "awaiting_event_name": {
      const name = msg.text?.trim();
      if (!name) return false;
      await usersRepo.setState(user.user_id, "idle");
      const event = await setActiveEvent(user.user_id, name);
      await whatsappClient.sendText(phoneNumberId, from, Copy.eventConfirmed(event.name));
      return true;
    }

    case "awaiting_account_settings_choice": {
      if (msg.buttonId === Ids.accountCheckCredit) {
        await usersRepo.setState(user.user_id, "idle");
        await whatsappClient.sendText(phoneNumberId, from, Copy.coinBalance(user.effective_coin_balance));
        return true;
      }
      if (msg.buttonId === Ids.accountConnectGmail) {
        await usersRepo.setState(user.user_id, "idle");
        if (!isGmailFollowUpEnabled) {
          await whatsappClient.sendText(
            phoneNumberId,
            from,
            "Gmail follow-up isn't configured on this server yet.",
          );
          return true;
        }
        const authUrl = buildGoogleAuthUrl(user.user_id);
        await whatsappClient.sendText(phoneNumberId, from, Copy.gmailNotConnected(authUrl));
        return true;
      }
      return false;
    }

    case "awaiting_email_review": {
      const cardId = user.active_visiting_card_id;
      if (msg.buttonId === Ids.emailReviewChange) {
        await usersRepo.setState(user.user_id, "idle");
        await whatsappClient.sendText(phoneNumberId, from, Copy.emailDraftDismissed);
        return true;
      }
      if (msg.buttonId === Ids.emailReviewApprove && cardId) {
        await usersRepo.setState(user.user_id, "idle");
        try {
          await sendApprovedDraft(user.user_id, cardId);
          await whatsappClient.sendText(phoneNumberId, from, Copy.emailDraftSaved);
        } catch (err) {
          if (err instanceof GmailNotConnectedError) {
            const authUrl = buildGoogleAuthUrl(user.user_id);
            await whatsappClient.sendText(phoneNumberId, from, Copy.gmailNotConnected(authUrl));
          } else {
            throw err;
          }
        }
        return true;
      }
      return false;
    }

    default:
      return false;
  }
}
