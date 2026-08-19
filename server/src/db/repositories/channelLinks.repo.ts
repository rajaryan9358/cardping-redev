import { supabase } from "../client";
import { ChannelLink, ChannelLinkChannel } from "../../types/domain";

async function findByUsersId(usersId: string): Promise<ChannelLink | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("*")
    .eq("users_id", usersId)
    .maybeSingle();
  if (error) throw error;
  return data as ChannelLink | null;
}

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

async function listByAccountId(accountId: string): Promise<ChannelLink[]> {
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
 * generic 500 (see the 409 handling in the channel-link API routes). */
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

async function deleteById(id: string, accountId: string): Promise<void> {
  const { error } = await supabase.from("channel_links").delete().eq("id", id).eq("account_id", accountId);
  if (error) throw error;
}

export const channelLinksRepo = {
  findByUsersId,
  findByChannelIdentifier,
  findByAccountAndChannel,
  listByAccountId,
  create,
  deleteById,
};
