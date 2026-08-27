import { supabase } from "../client";
import { Account } from "../../types/domain";

export interface SessionWithAccount {
  id: string;
  account_id: string;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  account: Account;
}

export type SessionSource = "login" | "magic_login";

export interface SessionRow {
  id: string;
  account_id: string;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  source: SessionSource;
  location: string | null;
}

async function create(input: {
  accountId: string;
  deviceLabel: string | null;
  userAgent: string | null;
  expiresAt: string;
  source?: SessionSource;
  location?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      account_id: input.accountId,
      device_label: input.deviceLabel,
      user_agent: input.userAgent,
      expires_at: input.expiresAt,
      source: input.source ?? "login",
      location: input.location ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function findWithAccount(sessionId: string): Promise<SessionWithAccount | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*, account:accounts(*)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as SessionWithAccount;
}

async function touch(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

async function deleteById(sessionId: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

async function deleteByIdForAccount(sessionId: string, accountId: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("account_id", accountId);
  if (error) throw error;
}

async function deleteAllForAccount(accountId: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("account_id", accountId);
  if (error) throw error;
}

async function listForAccount(accountId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, account_id, device_label, user_agent, created_at, last_seen_at, expires_at, source, location")
    .eq("account_id", accountId)
    .neq("source", "magic_login")
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return data as SessionRow[];
}

export const sessionsRepo = {
  create,
  findWithAccount,
  touch,
  deleteById,
  deleteByIdForAccount,
  deleteAllForAccount,
  listForAccount,
};
