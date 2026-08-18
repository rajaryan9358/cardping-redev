import "server-only";
import { adminNotificationsRepo } from "./repositories/adminNotifications.repo";
import { sendNotification } from "./notificationSend";

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** Runs on a timer (see instrumentation.ts) — finds every user due a
 * renewal reminder or low-balance alert and sends+logs one notification
 * each. Safe to call more often than needed: findRenewalCandidates /
 * findLowBalanceCandidates already dedupe against notification_log. */
export async function runNotificationChecks(): Promise<void> {
  const renewalCandidates = await adminNotificationsRepo.findRenewalCandidates();
  for (const user of renewalCandidates) {
    if (!user.wa_id) continue;
    await sendNotification({
      userId: user.id,
      waId: user.wa_id,
      type: "renewal_reminder",
      triggeredBy: "auto",
      variables: [user.full_name || "there", String(daysUntil(user.plan_expires_at))],
    });
  }

  const lowBalanceCandidates = await adminNotificationsRepo.findLowBalanceCandidates();
  for (const user of lowBalanceCandidates) {
    if (!user.wa_id) continue;
    await sendNotification({
      userId: user.id,
      waId: user.wa_id,
      type: "low_balance_alert",
      triggeredBy: "auto",
      variables: [user.full_name || "there", String(user.coin_balance)],
    });
  }
}
