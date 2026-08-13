import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { setActiveEvent } from "../../../services/eventService";
import { sendApprovedDraft, GmailNotConnectedError } from "../../../services/emailFollowUpService";
import { createTopUpLink } from "../../../services/paymentService";
import { buildGoogleAuthUrl } from "../../../integrations/gmail/oauth";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { Copy } from "../messages";
import { Ids } from "../ids";

/** Telegram counterpart of the WhatsApp bot's stateContinuation — see that
 * file for why this state machine exists at all. */
export async function tryContinuePendingState(
  msg: NormalizedTelegramMessage,
  user: UserWithEvent,
): Promise<boolean> {
  const { chatId } = msg;

  switch (user.user_state) {
    case "awaiting_event_name": {
      const name = msg.text?.trim();
      if (!name) return false;
      await usersRepo.setState(user.user_id, "idle");
      const event = await setActiveEvent(user.user_id, name);
      await telegramClient.sendMessage(chatId, Copy.eventConfirmed(event.name));
      return true;
    }

    case "awaiting_topup_phone": {
      const phone = msg.text?.replace(/\D/g, "");
      if (!phone || phone.length < 10) return false;
      await usersRepo.setState(user.user_id, "idle");
      const linkUrl = await createTopUpLink(user.user_id, phone);
      await telegramClient.sendMessage(chatId, Copy.paymentLink(linkUrl));
      return true;
    }

    case "awaiting_account_settings_choice": {
      if (msg.callbackData === Ids.accountCheckCredit) {
        await usersRepo.setState(user.user_id, "idle");
        await telegramClient.sendMessage(chatId, Copy.coinBalance(user.coin_balance));
        return true;
      }
      if (msg.callbackData === Ids.accountConnectGmail) {
        await usersRepo.setState(user.user_id, "idle");
        if (!isGmailFollowUpEnabled) {
          await telegramClient.sendMessage(chatId, "Gmail follow-up isn't configured on this server yet.");
          return true;
        }
        const authUrl = buildGoogleAuthUrl(user.user_id);
        await telegramClient.sendMessage(chatId, Copy.gmailNotConnected(authUrl));
        return true;
      }
      return false;
    }

    case "awaiting_email_review": {
      const cardId = user.active_visiting_card_id;
      if (msg.callbackData === Ids.emailReviewChange) {
        await usersRepo.setState(user.user_id, "idle");
        await telegramClient.sendMessage(chatId, Copy.emailDraftDismissed);
        return true;
      }
      if (msg.callbackData === Ids.emailReviewApprove && cardId) {
        await usersRepo.setState(user.user_id, "idle");
        try {
          await sendApprovedDraft(user.user_id, cardId);
          await telegramClient.sendMessage(chatId, Copy.emailDraftSaved);
        } catch (err) {
          if (err instanceof GmailNotConnectedError) {
            const authUrl = buildGoogleAuthUrl(user.user_id);
            await telegramClient.sendMessage(chatId, Copy.gmailNotConnected(authUrl));
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
