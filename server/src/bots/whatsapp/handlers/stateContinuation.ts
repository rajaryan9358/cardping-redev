import { whatsappClient } from "../../../integrations/whatsapp/client";
import { usersRepo } from "../../../db/repositories/users.repo";
import { accountsRepo } from "../../../db/repositories/accounts.repo";
import { setActiveEvent, setActiveEventById } from "../../../services/eventService";
import { finalizeScan } from "../../../services/scanFlowService";
import { getSubscriptionStatus } from "../../../services/subscriptionStatus";
import { sendApprovedDraft, GmailNotConnectedError } from "../../../services/emailFollowUpService";
import { buildGoogleAuthUrl } from "../../../integrations/gmail/oauth";
import { isGmailFollowUpEnabled } from "../../../config/env";
import { NormalizedWhatsAppMessage } from "../../../integrations/whatsapp/types";
import { UserWithEvent } from "../../../types/domain";
import { resumeScanAfterEventSet, sendScanResult } from "./image";
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
      if (user.pending_front_media_id) {
        await resumeScanAfterEventSet(phoneNumberId, from, user.user_id);
      } else {
        await whatsappClient.sendText(phoneNumberId, from, Copy.eventConfirmed(event.name));
      }
      return true;
    }

    case "awaiting_event_choice": {
      if (msg.buttonId === Ids.eventPickerNew) {
        await usersRepo.setState(user.user_id, "awaiting_event_name");
        await whatsappClient.sendText(phoneNumberId, from, Copy.askNewEventName);
        return true;
      }
      if (msg.buttonId?.startsWith(Ids.eventPickPrefix)) {
        const eventId = msg.buttonId.slice(Ids.eventPickPrefix.length);
        await usersRepo.setState(user.user_id, "idle");
        await setActiveEventById(user.user_id, eventId);
        if (user.pending_front_media_id) {
          await resumeScanAfterEventSet(phoneNumberId, from, user.user_id);
        } else {
          await whatsappClient.sendText(phoneNumberId, from, "Switched to that event.");
        }
        return true;
      }
      return false;
    }

    case "awaiting_back_photo": {
      if (msg.type !== "image" || !msg.mediaId || !user.pending_front_media_id) return false;
      await usersRepo.setState(user.user_id, "idle");

      const [front, back] = await Promise.all([
        whatsappClient.downloadMediaById(user.pending_front_media_id),
        whatsappClient.downloadMediaById(msg.mediaId),
      ]);
      const { card, extracted, draft } = await finalizeScan({
        userId: user.user_id,
        accountId: user.account_id,
        eventId: user.active_event_id!,
        channel: "whatsapp",
        messageId: msg.waMessageId,
        frontImageId: user.pending_front_media_id,
        frontImageBuffer: front.buffer,
        frontMimeType: front.mimeType,
        backImageId: msg.mediaId,
        backImageBuffer: back.buffer,
        backMimeType: back.mimeType,
        requester: { fullName: user.full_name, email: user.email },
        activeEventName: user.active_event_name,
      });
      await sendScanResult(phoneNumberId, from, msg.waMessageId, card, extracted, draft);
      return true;
    }

    case "awaiting_account_settings_choice": {
      if (msg.buttonId === Ids.accountSubscription) {
        await usersRepo.setState(user.user_id, "idle");
        const status = await getSubscriptionStatus(user);
        await whatsappClient.sendText(phoneNumberId, from, Copy.subscriptionSummary(status));
        return true;
      }
      if (msg.buttonId === Ids.accountScanBothSides) {
        await usersRepo.setState(user.user_id, "idle");
        const updated = await accountsRepo.update(user.account_id!, { scan_both_sides: !user.scan_both_sides });
        await whatsappClient.sendText(phoneNumberId, from, Copy.scanBothSidesToggled(updated.scan_both_sides));
        return true;
      }
      if (msg.buttonId === Ids.accountEventLifetime) {
        await usersRepo.setState(user.user_id, "awaiting_event_lifetime_choice");
        await sendEventLifetimePicker(phoneNumberId, from);
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

    case "awaiting_event_lifetime_choice": {
      if (!msg.buttonId || !(msg.buttonId in EVENT_LIFETIME_HOURS)) return false;
      await usersRepo.setState(user.user_id, "idle");
      const hours = EVENT_LIFETIME_HOURS[msg.buttonId];
      await accountsRepo.update(user.account_id!, { event_lifetime_hours: hours });
      await whatsappClient.sendText(phoneNumberId, from, Copy.eventLifetimeSet(eventLifetimeLabel(hours)));
      return true;
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
