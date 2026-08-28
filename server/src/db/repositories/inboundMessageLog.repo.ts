import { supabase } from "../client";
import { childLogger } from "../../lib/logger";

const log = childLogger("inbound-message-log");

export interface InboundMessageLogEntry {
  channel: "whatsapp" | "telegram";
  usersId: string;
  accountId: string | null;
  messageType: string;
  content: string | null;
  channelMessageId: string | null;
}

/** Durable record of every real inbound message (never status callbacks —
 * see the migration's comment). Logging must never break the actual
 * message flow, so — same pattern as aiUsageLogRepo — this swallows its
 * own errors rather than throwing. */
async function record(entry: InboundMessageLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("inbound_message_log").insert({
      channel: entry.channel,
      users_id: entry.usersId,
      account_id: entry.accountId,
      message_type: entry.messageType,
      content: entry.content,
      channel_message_id: entry.channelMessageId,
    });
    if (error) throw error;
  } catch (err) {
    log.error({ err, entry }, "failed to write inbound message log");
  }
}

export interface InboundMessageLogRow extends InboundMessageLogEntry {
  id: string;
  createdAt: string;
}

async function listForUsersId(usersId: string, limit = 100): Promise<InboundMessageLogRow[]> {
  const { data, error } = await supabase
    .from("inbound_message_log")
    .select("id, channel, users_id, account_id, message_type, content, channel_message_id, created_at")
    .eq("users_id", usersId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    usersId: row.users_id,
    accountId: row.account_id,
    messageType: row.message_type,
    content: row.content,
    channelMessageId: row.channel_message_id,
    createdAt: row.created_at,
  }));
}

export const inboundMessageLogRepo = { record, listForUsersId };
