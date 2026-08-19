import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { accountsRepo } from "../../../db/repositories/accounts.repo";
import { setActiveEvent, setActiveEventById } from "../../../services/eventService";
import { finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { sendApprovedDraft, GmailNotConnectedError } from "../../../services/emailFollowUpService";
import { buildGoogleAuthUrl } from "../../../integrations/gmail/oauth";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { resumeScanAfterEventSet, sendScanResult } from "./photo";
import { Copy, sendEventLifetimePicker, eventLifetimeLabel } from "../messages";
import { Ids } from "../ids";

const EVENT_LIFETIME_HOURS: Record<string, number | null> = {
  [Ids.eventLifetime1h]: 1,
  [Ids.eventLifetime6h]: 6,
  [Ids.eventLifetime12h]: 12,
  [Ids.eventLifetime24h]: 24,
  [Ids.eventLifetime48h]: 48,
  [Ids.eventLifetimeAlways]: null,
};

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
      if (user.pending_front_media_id) {
        await resumeScanAfterEventSet(chatId, user.user_id);
      } else {
        await telegramClient.sendMessage(chatId, Copy.eventConfirmed(event.name));
      }
      return true;
    }

    case "awaiting_event_choice": {
      if (msg.callbackData === Ids.eventPickerNew) {
        await usersRepo.setState(user.user_id, "awaiting_event_name");
        await telegramClient.sendMessage(chatId, Copy.askNewEventName);
        return true;
      }
      if (msg.callbackData?.startsWith(Ids.eventPickPrefix)) {
        const eventId = msg.callbackData.slice(Ids.eventPickPrefix.length);
        await usersRepo.setState(user.user_id, "idle");
        await setActiveEventById(user.user_id, eventId);
        if (user.pending_front_media_id) {
          await resumeScanAfterEventSet(chatId, user.user_id);
        } else {
          await telegramClient.sendMessage(chatId, "Switched to that event.");
        }
        return true;
      }
      return false;
    }

    case "awaiting_back_photo": {
      if (msg.type !== "photo" || !msg.photoFileId || !user.pending_front_media_id) return false;
      await usersRepo.setState(user.user_id, "idle");

      const [frontBuffer, backBuffer] = await Promise.all([
        telegramClient.downloadFileById(user.pending_front_media_id),
        telegramClient.downloadFileById(msg.photoFileId),
      ]);
      const { card, extracted, draft } = await finalizeScan({
        userId: user.user_id,
        accountId: user.account_id,
        eventId: user.active_event_id!,
        channel: "telegram",
        messageId: String(msg.messageId),
        frontImageId: user.pending_front_media_id,
        frontImageBuffer: frontBuffer,
        frontMimeType: "image/jpeg",
        backImageId: msg.photoFileId,
        backImageBuffer: backBuffer,
        backMimeType: "image/jpeg",
        requester: { fullName: user.full_name, email: user.email },
        activeEventName: user.active_event_name,
      });
      await sendScanResult(chatId, msg.messageId ?? undefined, card, extracted, draft);
      return true;
    }

    case "awaiting_account_settings_choice": {
      if (msg.callbackData === Ids.accountSubscription) {
        await usersRepo.setState(user.user_id, "idle");
        const status = await getSubscriptionStatus(user);
        await telegramClient.sendMessage(chatId, Copy.subscriptionSummary(status));
        return true;
      }
      if (msg.callbackData === Ids.accountScanBothSides) {
        await usersRepo.setState(user.user_id, "idle");
        const updated = await accountsRepo.update(user.account_id!, { scan_both_sides: !user.scan_both_sides });
        await telegramClient.sendMessage(chatId, Copy.scanBothSidesToggled(updated.scan_both_sides));
        return true;
      }
      if (msg.callbackData === Ids.accountEventLifetime) {
        await usersRepo.setState(user.user_id, "awaiting_event_lifetime_choice");
        await sendEventLifetimePicker(chatId);
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

    case "awaiting_event_lifetime_choice": {
      if (!msg.callbackData || !(msg.callbackData in EVENT_LIFETIME_HOURS)) return false;
      await usersRepo.setState(user.user_id, "idle");
      const hours = EVENT_LIFETIME_HOURS[msg.callbackData];
      await accountsRepo.update(user.account_id!, { event_lifetime_hours: hours });
      await telegramClient.sendMessage(chatId, Copy.eventLifetimeSet(eventLifetimeLabel(hours)));
      return true;
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
