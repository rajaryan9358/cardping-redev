import { telegramClient } from "../../../integrations/telegram/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { accountsRepo } from "../../../db/repositories/accounts.repo";
import { setActiveEvent, setActiveEventById, isEventExpired } from "../../../services/eventService";
import { finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { createMagicLoginLink } from "../../../services/magicLoginService";
import { registerCardMessageRef } from "../../../services/cardService";
import { NormalizedTelegramMessage } from "../../../integrations/telegram/types";
import { UserWithEvent } from "../../../types/domain";
import { resumeScanAfterEventSet, sendScanResult } from "./photo";
import { Copy, sendEventLifetimePicker, sendEventPicker, eventLifetimeLabel } from "../messages";
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
        await telegramClient.sendMessage(chatId, Copy.eventConfirmed(event.name, user.event_lifetime_hours));
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
        const eventName = await setActiveEventById(user.user_id, eventId);
        await usersRepo.setState(user.user_id, "idle");
        if (user.pending_front_media_id) {
          await resumeScanAfterEventSet(chatId, user.user_id);
        } else {
          await telegramClient.sendMessage(chatId, Copy.eventSwitched(eventName, user.event_lifetime_hours));
        }
        return true;
      }
      return false;
    }

    case "awaiting_back_photo": {
      if (msg.type !== "photo" || !msg.photoFileId || !user.pending_front_media_id) return false;

      // The event may have expired while we were waiting for the back
      // photo — don't tag the card to a stale event. Hold both images and
      // ask for a fresh one instead, same picker as a brand-new scan.
      if (!user.active_event_id || isEventExpired(user)) {
        await usersRepo.setPendingMedia(user.user_id, user.pending_front_media_id, msg.photoFileId);
        await usersRepo.setState(user.user_id, "awaiting_event_choice");
        await sendEventPicker(chatId, user.user_id);
        return true;
      }

      await usersRepo.setState(user.user_id, "idle");

      const [frontBuffer, backBuffer] = await Promise.all([
        telegramClient.downloadFileById(user.pending_front_media_id),
        telegramClient.downloadFileById(msg.photoFileId),
      ]);
      await telegramClient.sendMessage(chatId, Copy.processingCard);
      const { card, extracted } = await finalizeScan({
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
      });
      if (msg.messageId) await registerCardMessageRef(card.id, String(msg.messageId));
      await sendScanResult(chatId, msg.messageId ?? undefined, card, extracted, user);
      return true;
    }

    case "awaiting_account_settings_choice": {
      if (msg.callbackData === Ids.accountSubscription) {
        await usersRepo.setState(user.user_id, "idle");
        const status = await getSubscriptionStatus(user);
        const manageUrl = await createMagicLoginLink(user.account_id!, "/subscribe?returnTo=telegram");
        await telegramClient.sendMessage(chatId, Copy.subscriptionSummary(status, manageUrl));
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

    default:
      return false;
  }
}
