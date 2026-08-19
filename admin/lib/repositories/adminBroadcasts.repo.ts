import "server-only";
import { supabase } from "../supabase";
import { env } from "../env";
import { Paginated } from "./adminUsers.repo";
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
 * floor every broadcast audience sits inside, no exceptions (see
 * marketing_opt_in's false default in schema.sql). `filter` narrows
 * further; it never widens past that floor. */
async function getOptedInAudience(channel: BroadcastChannel, filter: AudienceFilter = "all"): Promise<AudienceUser[]> {
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

async function getPendingRecipients(campaignId: string) {
  const { data, error } = await supabase
    .from("broadcast_recipients")
    .select("id, user_id, user:users(wa_id, telegram_chat_id)")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
  }));
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
  listCampaigns,
  getRecipientCounts,
};
