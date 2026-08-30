import "server-only";
import { env } from "./env";
import { sendWhatsAppTemplate, sendWhatsAppText, sendTelegramBroadcastMessage } from "./broadcastSend";
import {
  adminNotificationsRepo,
  NotificationTriggeredBy,
  NotificationType,
} from "./repositories/adminNotifications.repo";

const WITHIN_24H_MS = 24 * 60 * 60 * 1000;

interface SendNotificationInput {
  userId: string;
  channel: "whatsapp" | "telegram";
  // WhatsApp: the phone number (wa_id). Telegram: the chat id.
  identifier: string;
  type: NotificationType;
  triggeredBy: NotificationTriggeredBy;
  adminUserId?: string;
  /** Variables for the WhatsApp template body, in template order — also
   * fed into MESSAGE_BODY for Telegram, or for WhatsApp inside the 24h
   * window (see below). */
  variables: string[];
  /** WhatsApp only — omit/null if unknown. Meta only allows free text
   * inside the 24h customer-service window; outside it (or when this
   * isn't known), the approved template is required. Telegram has no such
   * restriction and always sends the composed message regardless. */
  lastLogin?: string | null;
}

const TEMPLATE_NAME: Record<NotificationType, string> = {
  renewal_reminder: env.WHATSAPP_RENEWAL_TEMPLATE_NAME,
  low_balance_alert: env.WHATSAPP_LOW_BALANCE_TEMPLATE_NAME,
};

// The exact same content as the approved WhatsApp template, fully
// substituted into plain text — used for Telegram always (no
// approved-template system there), and for WhatsApp when the recipient is
// inside their 24h window, where free text is allowed and reads more
// naturally than the formal template mechanism. Must stay word-for-word
// identical to what's registered with Meta, since it's the same message,
// just delivered differently depending on the window.
const MESSAGE_BODY: Record<NotificationType, (variables: string[]) => string> = {
  renewal_reminder: ([name]) => `Hi ${name || "there"}, your plan is expiring soon — renew to keep your benefits.`,
  // Deliberately Utility-worded (a plain account-status fact, no "top up
  // now" call-to-action) — that phrasing is what got Meta to classify the
  // WhatsApp template as Utility rather than Marketing.
  low_balance_alert: ([name, balance]) =>
    `Hi ${name || "there"}, your CardPing account currently has ${balance ?? "a low number of"} credits remaining. Manage your balance anytime from your dashboard.`,
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
      await sendTelegramBroadcastMessage(input.identifier, MESSAGE_BODY[input.type](input.variables));
    } else {
      const within24h = !!input.lastLogin && Date.now() - new Date(input.lastLogin).getTime() < WITHIN_24H_MS;
      if (within24h) {
        await sendWhatsAppText(input.identifier, MESSAGE_BODY[input.type](input.variables));
      } else {
        await sendWhatsAppTemplate(input.identifier, TEMPLATE_NAME[input.type], "en", input.variables);
      }
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
