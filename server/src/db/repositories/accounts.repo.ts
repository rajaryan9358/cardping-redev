import { supabase } from "../client";
import { Account } from "../../types/domain";

async function findById(accountId: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

async function findByEmail(email: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

async function findByGoogleId(googleId: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select("*").eq("google_id", googleId).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

async function findByMobile(mobile: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select("*").eq("mobile", mobile).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

async function create(input: Partial<Account>): Promise<Account> {
  const { data, error } = await supabase.from("accounts").insert(input).select("*").single();
  if (error) throw error;
  return data as Account;
}

async function update(accountId: string, patch: Partial<Account>): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Account;
}

async function decrementCoinBalance(accountId: string): Promise<Account> {
  const { data, error } = await supabase.rpc("account_decrement_coin_balance", { account_uuid: accountId });
  if (error) throw error;
  return data as Account;
}

async function incrementCoinBalance(accountId: string, amount: number): Promise<Account> {
  const { data, error } = await supabase.rpc("account_increment_coin_balance", {
    account_uuid: accountId,
    amount,
  });
  if (error) throw error;
  return data as Account;
}

async function adjustCoinBalance(accountId: string, delta: number, reason?: string): Promise<Account> {
  const { data, error } = await supabase.rpc("admin_adjust_account_coin_balance", {
    account_uuid: accountId,
    delta,
    reason: reason ?? null,
  });
  if (error) throw error;
  return data as Account;
}

export const accountsRepo = {
  findById,
  findByEmail,
  findByGoogleId,
  findByMobile,
  create,
  update,
  decrementCoinBalance,
  incrementCoinBalance,
  adjustCoinBalance,
};
