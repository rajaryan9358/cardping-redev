import "server-only";
import { env } from "./env";
import { sendWhatsAppTemplate, sendTelegramBroadcastMessage } from "./broadcastSend";
import {
  adminNotificationsRepo,
  NotificationTriggeredBy,
  NotificationType,
} from "./repositories/adminNotifications.repo";

interface SendNotificationInput {
  userId: string;
  channel: "whatsapp" | "telegram";
  // WhatsApp: the phone number (wa_id). Telegram: the chat id.
  identifier: string;
  type: NotificationType;
  triggeredBy: NotificationTriggeredBy;
  adminUserId?: string;
  /** Variables for the WhatsApp template body, in template order — unused
   * for Telegram, which sends a plain composed string instead (no
   * approved-template requirement, no 24h window restriction). */
  variables: string[];
}

const TEMPLATE_NAME: Record<NotificationType, string> = {
  renewal_reminder: env.WHATSAPP_RENEWAL_TEMPLATE_NAME,
  low_balance_alert: env.WHATSAPP_LOW_BALANCE_TEMPLATE_NAME,
};

// Telegram has no approved-template system — a low-balance alert there is
// just a plain message built from the same [name, balance] variables the
// WhatsApp template takes (see sendLowBalanceAlertAction), so the two
// channels stay in sync content-wise.
const TELEGRAM_MESSAGE: Record<NotificationType, (variables: string[]) => string> = {
  renewal_reminder: ([name]) => `Hi ${name || "there"}, your plan is expiring soon — renew to keep your benefits.`,
  low_balance_alert: ([name, balance]) => `Hi ${name || "there"}, you have ${balance ?? "a low number of"} credits left — top up to keep scanning.`,
};

/** The one place both the scheduler and the manual "Send reminder"/"Send
 * alert" Server Actions call through — sends via the existing Broadcasts
 * send client (reused, not duplicated again) and always writes exactly
 * one notification_log row, sent or failed. Returns whether the send
 * actually succeeded — a manual trigger (unlike the scheduler) has a human
 * waiting on the result, so swallowing the outcome entirely (as this used
 * to) made a failed send look identical to a successful one in the UI. */
export async function sendNotification(input: SendNotificationInput): Promise<{ sent: boolean; error?: string }> {
  try {
    if (input.channel === "telegram") {
      await sendTelegramBroadcastMessage(input.identifier, TELEGRAM_MESSAGE[input.type](input.variables));
    } else {
      await sendWhatsAppTemplate(input.identifier, TEMPLATE_NAME[input.type], "en", input.variables);
    }
    await adminNotificationsRepo.logNotification({
      userId: input.userId,
      channel: input.channel,
      type: input.type,
      triggeredBy: input.triggeredBy,
      status: "sent",
      adminUserId: input.adminUserId,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await adminNotificationsRepo.logNotification({
      userId: input.userId,
      channel: input.channel,
      type: input.type,
      triggeredBy: input.triggeredBy,
      status: "failed",
      error: message,
      adminUserId: input.adminUserId,
    });
    return { sent: false, error: message };
  }
}
