import { supabase } from "../client";

export interface NotificationLogRow {
  id: string;
  type: string;
  status: string;
  created_at: string;
}

/** Notifications sent to any of the given channel-identity user ids —
 * used to resolve "notifications for this dashboard account" via
 * channel_links (see routes/api/account.route.ts's GET /notifications),
 * since notification_log.user_id references a channel identity, not an
 * account directly. */
async function listForUserIds(userIds: string[], limit: number): Promise<NotificationLogRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("notification_log")
    .select("id, type, status, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as NotificationLogRow[];
}

export const notificationsRepo = {
  listForUserIds,
};
