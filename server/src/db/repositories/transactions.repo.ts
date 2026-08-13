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

async function recordCardScan(userId: string): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .insert({ user_id: userId, type: "card_scan", coins: -1, status: "completed" });
  if (error) throw error;
}

export const transactionsRepo = {
  createPendingPurchase,
  findByCashfreeLinkId,
  markCompleted,
  markFailed,
  recordCardScan,
};
