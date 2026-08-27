import { supabase } from "../client";
import { ChannelLink, ChannelLinkChannel } from "../../types/domain";

/** The channel identity's currently-active link, if any — null once
 * disconnected (unlinked_at set), same as if it had never been linked.
 * Used by the bot routers' "have they linked a dashboard account?" gate. */
async function findActiveByUsersId(usersId: string): Promise<ChannelLink | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("users_id", usersId)
    .is("unlinked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as ChannelLink | null;
}

/** Regardless of active/disconnected — idx_channel_links_users_id is
 * unique on users_id alone, so there is at most one row per channel
 * identity ever. Used to tell "never connected" (send to signup) apart
 * from "connected before, currently disconnected" (send to login/welcome
 * back) — see channelOnboardingService.ts and the bot routers. */
async function findAnyByUsersId(usersId: string): Promise<ChannelLink | null> {
  const { data, error } = await supabase.from("channel_links").select("*").eq("users_id", usersId).maybeSingle();
  if (error) throw error;
  return data as ChannelLink | null;
}

/** Any row for this identifier, active or not — callers decide what "already
 * linked" should mean given the row's account_id/unlinked_at (same account
 * reconnecting vs. a different account's claim). */
async function findByChannelIdentifier(
  channel: ChannelLinkChannel,
  channelIdentifier: string,
): Promise<ChannelLink | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("channel", channel)
    .eq("channel_identifier", channelIdentifier)
    .maybeSingle();
  if (error) throw error;
  return data as ChannelLink | null;
}

/** Currently-connected channels only — every display/"what can this
 * account currently do" caller (Channels settings page, notification
 * routing, marketing opt-in). For "everything this account has ever
 * owned" (cards/events data scope), see listAllByAccountId instead. */
async function listByAccountId(accountId: string): Promise<ChannelLink[]> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("account_id", accountId)
    .is("unlinked_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as ChannelLink[];
}

/** Every channel ever linked to this account, connected or not — the data-
 * ownership scope (see accountScope.ts#resolveUsersIds). A disconnected
 * channel's cards/events must stay visible to the account that scanned
 * them; only the *current* channel list (listByAccountId) should shrink
 * on disconnect, never the account's own data. */
async function listAllByAccountId(accountId: string): Promise<ChannelLink[]> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as ChannelLink[];
}

async function findByAccountAndChannel(accountId: string, channel: ChannelLinkChannel): Promise<ChannelLink | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("account_id", accountId)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw error;
  return data as ChannelLink | null;
}

/** Throws a Postgres unique-violation error (code 23505) if this channel
 * identifier or users row is already linked — callers should catch that
 * and surface it as "already connected to another account," not a
 * generic 500 (see the 409 handling in the channel-link API routes). Only
 * for a genuinely new identity — reconnecting one that's linked before
 * (even if currently disconnected) goes through reactivate() instead, see
 * channelLinkService.ts#linkChannel. */
async function create(input: {
  accountId: string;
  usersId: string;
  channel: ChannelLinkChannel;
  channelIdentifier: string;
  verifiedAt?: string;
}): Promise<ChannelLink> {
  const { data, error } = await supabase
    .from("channel_links")
    .insert({
      account_id: input.accountId,
      users_id: input.usersId,
      channel: input.channel,
      channel_identifier: input.channelIdentifier,
      verified_at: input.verifiedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChannelLink;
}

/** Reconnects a channel identity that was linked before — clears
 * unlinked_at on its existing row instead of inserting a new one, so its
 * full connection history (original created_at, this reconnection) stays
 * on one row. channel/channelIdentifier are re-stamped in case either
 * changed (e.g. a corrected phone-number format) since it was first
 * linked. */
async function reactivate(id: string, channel: ChannelLinkChannel, channelIdentifier: string): Promise<ChannelLink> {
  const { data, error } = await supabase
    .from("channel_links")
    .update({ unlinked_at: null, channel, channel_identifier: channelIdentifier, verified_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ChannelLink;
}

/** Disconnect — soft delete. Preserves the row (and its card/event
 * ownership, and its connection history) rather than destroying it; see
 * db/2026-08-27_channel_account_model_fix.sql for why. */
async function unlinkById(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from("channel_links")
    .update({ unlinked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", accountId);
  if (error) throw error;
}

export const channelLinksRepo = {
  findActiveByUsersId,
  findAnyByUsersId,
  findByChannelIdentifier,
  findByAccountAndChannel,
  listByAccountId,
  listAllByAccountId,
  create,
  reactivate,
  unlinkById,
};
