import "server-only";
import { env } from "./env";
import { sendWhatsAppTemplate } from "./broadcastSend";
import {
  adminNotificationsRepo,
  NotificationTriggeredBy,
  NotificationType,
} from "./repositories/adminNotifications.repo";

interface SendNotificationInput {
  userId: string;
  waId: string;
  type: NotificationType;
  triggeredBy: NotificationTriggeredBy;
  adminUserId?: string;
  /** Variables for the template body, in template order. */
  variables: string[];
}

const TEMPLATE_NAME: Record<NotificationType, string> = {
  renewal_reminder: env.WHATSAPP_RENEWAL_TEMPLATE_NAME,
  low_balance_alert: env.WHATSAPP_LOW_BALANCE_TEMPLATE_NAME,
};

/** The one place both the scheduler and the manual "Send reminder"/"Send
 * alert" Server Actions call through — sends via the existing Broadcasts
 * send client (reused, not duplicated again) and always writes exactly
 * one notification_log row, sent or failed. */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    await sendWhatsAppTemplate(input.waId, TEMPLATE_NAME[input.type], "en", input.variables);
    await adminNotificationsRepo.logNotification({
      userId: input.userId,
      type: input.type,
      triggeredBy: input.triggeredBy,
      status: "sent",
      adminUserId: input.adminUserId,
    });
  } catch (error) {
    await adminNotificationsRepo.logNotification({
      userId: input.userId,
      type: input.type,
      triggeredBy: input.triggeredBy,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      adminUserId: input.adminUserId,
    });
  }
}
