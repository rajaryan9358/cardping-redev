import { supabase } from "../client";
import { GmailTokens } from "../../types/domain";

async function findByUserId(userId: string): Promise<GmailTokens | null> {
  const { data, error } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as GmailTokens | null;
}

async function upsert(
  userId: string,
  refreshToken: string,
  emailAddress: string | null,
): Promise<GmailTokens> {
  const existing = await findByUserId(userId);

  if (existing) {
    const { data, error } = await supabase
      .from("gmail_tokens")
      .update({ refresh_token: refreshToken, email_address: emailAddress })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as GmailTokens;
  }

  const { data, error } = await supabase
    .from("gmail_tokens")
    .insert({ user_id: userId, refresh_token: refreshToken, email_address: emailAddress })
    .select("*")
    .single();
  if (error) throw error;
  return data as GmailTokens;
}

export const gmailTokensRepo = { findByUserId, upsert };
