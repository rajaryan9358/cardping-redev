import "server-only";
import { supabase } from "../supabase";
import { env } from "../env";
import { Paginated } from "./adminUsers.repo";

export type NotificationType = "renewal_reminder" | "low_balance_alert";
export type NotificationTriggeredBy = "manual" | "auto";
export type NotificationStatus = "pending" | "sent" | "failed";

export interface RenewalCandidate {
  id: string;
  wa_id: string | null;
  full_name: string | null;
  plan_id: string;
  plan_expires_at: string;
}

/** Users whose plan expires within the reminder window, still unblocked
 * and reachable, who haven't already been reminded for this expiry cycle
 * — the dedupe window is one day wider than the reminder window so a
 * cycle only ever produces one reminder regardless of check frequency. */
async function findRenewalCandidates(): Promise<RenewalCandidate[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + env.RENEWAL_REMINDER_DAYS_BEFORE_EXPIRY * 86400000);
  const dedupeSince = new Date(
    now.getTime() - (env.RENEWAL_REMINDER_DAYS_BEFORE_EXPIRY + 1) * 86400000,
  );

  const { data: candidates, error } = await supabase
    .from("users")
    .select("id, wa_id, full_name, plan_id, plan_expires_at")
    .not("plan_id", "is", null)
    .not("wa_id", "is", null)
    .is("blocked_at", null)
    .gte("plan_expires_at", now.toISOString())
    .lte("plan_expires_at", windowEnd.toISOString());
  if (error) throw error;
  if (!candidates || candidates.length === 0) return [];

  const { data: recentLogs, error: logError } = await supabase
    .from("notification_log")
    .select("user_id")
    .eq("type", "renewal_reminder")
    .gte("created_at", dedupeSince.toISOString())
    .in(
      "user_id",
      candidates.map((c) => c.id),
    );
  if (logError) throw logError;

  const alreadyNotified = new Set((recentLogs ?? []).map((l) => l.user_id));
  return candidates.filter((c) => !alreadyNotified.has(c.id)) as RenewalCandidate[];
}

export interface LowBalanceCandidate {
  id: string;
  wa_id: string | null;
  full_name: string | null;
  coin_balance: number;
}

const LOW_BALANCE_DEDUPE_DAYS = 7;

async function findLowBalanceCandidates(): Promise<LowBalanceCandidate[]> {
  const dedupeSince = new Date(Date.now() - LOW_BALANCE_DEDUPE_DAYS * 86400000);

  const { data: candidates, error } = await supabase
    .from("users")
    .select("id, wa_id, full_name, coin_balance")
    .lte("coin_balance", env.LOW_BALANCE_THRESHOLD)
    .not("wa_id", "is", null)
    .is("blocked_at", null);
  if (error) throw error;
  if (!candidates || candidates.length === 0) return [];

  const { data: recentLogs, error: logError } = await supabase
    .from("notification_log")
    .select("user_id")
    .eq("type", "low_balance_alert")
    .gte("created_at", dedupeSince.toISOString())
    .in(
      "user_id",
      candidates.map((c) => c.id),
    );
  if (logError) throw logError;

  const alreadyNotified = new Set((recentLogs ?? []).map((l) => l.user_id));
  return candidates.filter((c) => !alreadyNotified.has(c.id)) as LowBalanceCandidate[];
}

async function logNotification(input: {
  userId: string;
  type: NotificationType;
  triggeredBy: NotificationTriggeredBy;
  status: NotificationStatus;
  error?: string | null;
  adminUserId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("notification_log").insert({
    user_id: input.userId,
    type: input.type,
    triggered_by: input.triggeredBy,
    status: input.status,
    error: input.error ?? null,
    admin_user_id: input.adminUserId ?? null,
  });
  if (error) throw error;
}

export interface NotificationLogRow {
  id: string;
  type: NotificationType;
  triggered_by: NotificationTriggeredBy;
  status: NotificationStatus;
  error: string | null;
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
  admin: { email: string } | null;
}

export interface ListNotificationLogParams {
  type?: NotificationType;
  triggeredBy?: NotificationTriggeredBy;
  page: number;
  pageSize: number;
}

async function listNotificationLog(
  params: ListNotificationLogParams,
): Promise<Paginated<NotificationLogRow>> {
  let query = supabase
    .from("notification_log")
    .select(
      "id, type, triggered_by, status, error, created_at, user:users!notification_log_user_id_fkey(full_name, email), admin:admin_users(email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.type) query = query.eq("type", params.type);
  if (params.triggeredBy) query = query.eq("triggered_by", params.triggeredBy);

  const from = (params.page - 1) * params.pageSize;
  const { data, error, count } = await query.range(from, from + params.pageSize - 1);
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
    admin: Array.isArray(row.admin) ? row.admin[0] ?? null : row.admin,
  }));
  return { rows: rows as unknown as NotificationLogRow[], total: count ?? 0 };
}

export const adminNotificationsRepo = {
  findRenewalCandidates,
  findLowBalanceCandidates,
  logNotification,
  listNotificationLog,
};
