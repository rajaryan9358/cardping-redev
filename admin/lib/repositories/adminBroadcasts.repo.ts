import "server-only";
import { supabase } from "../supabase";
import { env } from "../env";
import { Paginated, getLinkedUsersIdSet } from "./adminUsers.repo";
import { AudienceFilter } from "../audienceFilter";

export type { AudienceFilter } from "../audienceFilter";

export type BroadcastChannel = "whatsapp" | "telegram";
export type BroadcastStatus = "draft" | "sending" | "completed" | "failed";
export type RecipientStatus = "pending" | "sent" | "failed";

export interface AudienceUser {
  id: string;
  wa_id: string | null;
  telegram_chat_id: string | null;
}

/** Opted-in, unblocked users reachable on the given channel — the hard
 * floor every broadcast audience sits inside, no exceptions for any
 * filter value EXCEPT `contacted_never_signed_up`, which deliberately
 * bypasses it (see the carve-out branch and getContactedNeverSignedUpAudience
 * below — marketing_opt_in's false default in schema.sql). Every other
 * `filter` value narrows further; none of them widen past this floor. */
async function getOptedInAudience(channel: BroadcastChannel, filter: AudienceFilter = "all"): Promise<AudienceUser[]> {
  // COMPLIANCE CARVE-OUT: the only audience that skips the opt-in floor
  // below. It targets people who've never opted in because they've never
  // signed up at all — a one-time "finish signing up" nudge, not
  // marketing (see audienceFilter.ts's label and BroadcastComposer's
  // warning badge). Kept as an early return, not folded into the switch
  // underneath, so the bypass stays impossible to miss on read.
  if (filter === "contacted_never_signed_up") {
    return getContactedNeverSignedUpAudience(channel);
  }

  // `query` is `any` here on purpose: supabase-js's PostgrestFilterBuilder
  // generic blows up TS's instantiation depth (TS2589) once you reassign
  // it across a switch with this many chained `.eq`/`.is`/`.not`/`.gt`
  // calls. Column names below are hardcoded strings we control, so the
  // type safety `any` gives up here isn't load-bearing.
  const column = channel === "whatsapp" ? "wa_id" : "telegram_chat_id";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("users")
    .select("id, wa_id, telegram_chat_id")
    .eq("marketing_opt_in", true)
    .is("blocked_at", null)
    .not(column, "is", null);

  const nowIso = new Date().toISOString();
  switch (filter) {
    case "subscribed":
      query = query.not("plan_id", "is", null).gt("plan_expires_at", nowIso);
      break;
    case "low_balance":
      query = query.lte("coin_balance", env.LOW_BALANCE_THRESHOLD);
      break;
    case "trial":
      query = query.is("plan_id", null).gt("coin_balance", 0);
      break;
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AudienceUser[];
}

/** The compliance carve-out itself — see getOptedInAudience's comment.
 * Audience = bot contacts on this channel who never linked to an account
 * (same anti-join as the WhatsApp/Telegram Contacts tabs, see
 * adminUsers.repo.ts#getLinkedUsersIdSet) — deliberately with no
 * marketing_opt_in condition at all, since these people have never had
 * the chance to opt in or out. Still respects blocked_at. */
async function getContactedNeverSignedUpAudience(channel: BroadcastChannel): Promise<AudienceUser[]> {
  const column = channel === "whatsapp" ? "wa_id" : "telegram_chat_id";
  const [linkedIds, { data, error }] = await Promise.all([
    getLinkedUsersIdSet(),
    supabase.from("users").select("id, wa_id, telegram_chat_id").is("blocked_at", null).not(column, "is", null),
  ]);
  if (error) throw error;
  return ((data ?? []) as AudienceUser[]).filter((u) => !linkedIds.has(u.id));
}

async function createCampaign(input: {
  channel: BroadcastChannel;
  templateName: string | null;
  body: string;
  audienceDescription: string;
  audienceFilter: AudienceFilter;
  createdBy: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("broadcast_campaigns")
    .insert({
      channel: input.channel,
      template_name: input.templateName,
      body: input.body,
      audience_description: input.audienceDescription,
      audience_filter: input.audienceFilter,
      status: "sending",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function getCampaignById(campaignId: string) {
  const { data, error } = await supabase
    .from("broadcast_campaigns")
    .select("id, channel, template_name, body, audience_filter")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function insertRecipients(campaignId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase
    .from("broadcast_recipients")
    .insert(userIds.map((userId) => ({ campaign_id: campaignId, user_id: userId, status: "pending" })));
  if (error) throw error;
}

async function setCampaignStatus(campaignId: string, status: BroadcastStatus): Promise<void> {
  await supabase.from("broadcast_campaigns").update({ status }).eq("id", campaignId);
}

async function setRecipientResult(
  recipientId: string,
  status: RecipientStatus,
  error: string | null,
): Promise<void> {
  await supabase
    .from("broadcast_recipients")
    .update({ status, error, sent_at: status === "sent" ? new Date().toISOString() : null })
    .eq("id", recipientId);
}

export interface PendingRecipient {
  id: string; // broadcast_recipients.id
  user_id: string;
  full_name: string | null;
  wa_id: string | null;
  telegram_chat_id: string | null;
  effective_coin_balance: number;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
}

/** `user_with_event` is a VIEW, not a table — broadcast_recipients.user_id's
 * FK targets `users` directly, so PostgREST can't embed the view via its
 * usual FK-shorthand `select("...:table(...)")` syntax. Two queries +
 * merge-by-id in application code instead, same pattern used throughout
 * this file and adminUsers.repo.ts. Reading through the view (rather than
 * `users` directly, as the old version did) gets effective_* precedence
 * for free — a linked account's real coin balance/plan, not a stale
 * per-channel column. */
async function getPendingRecipients(campaignId: string): Promise<PendingRecipient[]> {
  const { data: recipients, error } = await supabase
    .from("broadcast_recipients")
    .select("id, user_id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (error) throw error;
  if (!recipients || recipients.length === 0) return [];

  const userIds = recipients.map((r) => r.user_id);
  const { data: users, error: usersErr } = await supabase
    .from("user_with_event")
    .select("user_id, full_name, wa_id, telegram_chat_id, effective_coin_balance, effective_plan_id, effective_plan_expires_at")
    .in("user_id", userIds);
  if (usersErr) throw usersErr;

  const byUserId = new Map((users ?? []).map((u) => [u.user_id, u]));
  return recipients.map((r) => {
    const u = byUserId.get(r.user_id);
    return {
      id: r.id,
      user_id: r.user_id,
      full_name: u?.full_name ?? null,
      wa_id: u?.wa_id ?? null,
      telegram_chat_id: u?.telegram_chat_id ?? null,
      effective_coin_balance: u?.effective_coin_balance ?? 0,
      effective_plan_id: u?.effective_plan_id ?? null,
      effective_plan_expires_at: u?.effective_plan_expires_at ?? null,
    };
  });
}

/** id -> name, for resolving the Subscription field. No `is_active`
 * filter — a lapsed/discontinued plan's name should still resolve for a
 * recipient who's still on it. */
async function getPlanNamesById(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("plans").select("id, name");
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

export interface AdminCampaignRow {
  id: string;
  channel: BroadcastChannel;
  template_name: string | null;
  body: string;
  audience_description: string | null;
  audience_filter: string | null;
  status: BroadcastStatus;
  created_at: string;
  creator: { email: string } | null;
}

async function listCampaigns(page: number, pageSize: number): Promise<Paginated<AdminCampaignRow>> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("broadcast_campaigns")
    .select(
      "id, channel, template_name, body, audience_description, audience_filter, status, created_at, creator:admin_users(email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    creator: Array.isArray(row.creator) ? row.creator[0] ?? null : row.creator,
  }));
  return { rows: rows as unknown as AdminCampaignRow[], total: count ?? 0 };
}

async function getRecipientCounts(campaignId: string): Promise<{ sent: number; failed: number; pending: number }> {
  const [sent, failed, pending] = await Promise.all([
    supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "sent"),
    supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "failed"),
    supabase.from("broadcast_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "pending"),
  ]);
  return { sent: sent.count ?? 0, failed: failed.count ?? 0, pending: pending.count ?? 0 };
}

export const adminBroadcastsRepo = {
  getOptedInAudience,
  createCampaign,
  getCampaignById,
  insertRecipients,
  setCampaignStatus,
  setRecipientResult,
  getPendingRecipients,
  getPlanNamesById,
  listCampaigns,
  getRecipientCounts,
};
