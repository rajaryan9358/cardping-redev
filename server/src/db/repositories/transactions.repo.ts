import { supabase } from "../client";
import { Transaction } from "../../types/domain";

async function createPendingPurchase(
  userId: string,
  coins: number,
  cashfreeLinkId: string,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "coin_purchase",
      coins,
      status: "pending",
      cashfree_link_id: cashfreeLinkId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Transaction;
}

/** For dashboard billing (subscription or coin purchase) — account-scoped,
 * unlike createPendingPurchase above which is the legacy bot-triggered
 * per-user top-up flow (kept as-is, still reachable from the bots). */
async function createPendingAccountPurchase(input: {
  accountId: string;
  type: "subscription_payment" | "coin_purchase";
  coins: number;
  amountInr: number;
  planId: string | null;
  cashfreeLinkId: string;
}): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      account_id: input.accountId,
      type: input.type,
      coins: input.coins,
      amount_inr: input.amountInr,
      plan_id: input.planId,
      status: "pending",
      cashfree_link_id: input.cashfreeLinkId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Transaction;
}

async function findById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Transaction | null;
}

async function listForAccount(accountId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Transaction[];
}

async function findByCashfreeLinkId(linkId: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("cashfree_link_id", linkId)
    .maybeSingle();
  if (error) throw error;
  return data as Transaction | null;
}

async function markCompleted(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update({ status: "completed" })
    .eq("id", transactionId);
  if (error) throw error;
}

async function markFailed(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update({ status: "failed" })
    .eq("id", transactionId);
  if (error) throw error;
}

async function recordCardScan(userId: string, accountId: string | null): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .insert({ user_id: userId, account_id: accountId, type: "card_scan", coins: -1, status: "completed" });
  if (error) throw error;
}

export const transactionsRepo = {
  createPendingPurchase,
  createPendingAccountPurchase,
  findById,
  listForAccount,
  findByCashfreeLinkId,
  markCompleted,
  markFailed,
  recordCardScan,
};
