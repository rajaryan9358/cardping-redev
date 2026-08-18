import "server-only";
import { supabase } from "../supabase";
import { Paginated } from "./adminUsers.repo";

export interface Plan {
  id: string;
  name: string;
  price_inr: number;
  period_days: number;
  coins_included: number;
  is_active: boolean;
}

async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_inr, period_days, coins_included, is_active")
    .eq("is_active", true)
    .order("price_inr", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export interface SubscriptionSummary {
  totalSubscribed: number;
  active: number;
  expired: number;
  totalEarningInr: number;
}

async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const nowIso = new Date().toISOString();

  const [totalRes, activeRes, expiredRes, earningRes] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).not("plan_id", "is", null),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .not("plan_id", "is", null)
      .gt("plan_expires_at", nowIso),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .not("plan_id", "is", null)
      .lte("plan_expires_at", nowIso),
    supabase
      .from("transactions")
      .select("amount_inr")
      .eq("type", "subscription_payment")
      .eq("status", "completed"),
  ]);

  if (totalRes.error) throw totalRes.error;
  if (activeRes.error) throw activeRes.error;
  if (expiredRes.error) throw expiredRes.error;
  if (earningRes.error) throw earningRes.error;

  const totalEarningInr = (earningRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0,
  );

  return {
    totalSubscribed: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    expired: expiredRes.count ?? 0,
    totalEarningInr,
  };
}

export interface SubscribedUserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  wa_id: string | null;
  plan_id: string;
  plan_expires_at: string | null;
}

async function listSubscribedUsers(page: number, pageSize: number): Promise<Paginated<SubscribedUserRow>> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("user_with_event")
    .select("user_id, full_name, email, wa_id, plan_id, plan_expires_at", { count: "exact" })
    .not("plan_id", "is", null)
    .order("plan_expires_at", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as SubscribedUserRow[], total: count ?? 0 };
}

/** Admin-manual "Change plan" action — no real checkout yet (see
 * docs/ADMIN_APP.md), so this both sets the user's plan/expiry and logs
 * the payment in one step. Extends from the current expiry if it's still
 * in the future (a renewal), otherwise starts fresh from now. */
async function setUserPlan(userId: string, plan: Plan): Promise<void> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("plan_expires_at")
    .eq("id", userId)
    .single();
  if (userError) throw userError;

  const base =
    user.plan_expires_at && new Date(user.plan_expires_at).getTime() > Date.now()
      ? new Date(user.plan_expires_at)
      : new Date();
  const expiresAt = new Date(base.getTime() + plan.period_days * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("users")
    .update({ plan_id: plan.id, plan_expires_at: expiresAt.toISOString() })
    .eq("id", userId);
  if (updateError) throw updateError;

  if (plan.coins_included > 0) {
    const { error: coinsError } = await supabase.rpc("increment_coin_balance", {
      user_uuid: userId,
      amount: plan.coins_included,
    });
    if (coinsError) throw coinsError;
  }

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "subscription_payment",
    coins: plan.coins_included,
    status: "completed",
    amount_inr: plan.price_inr,
    plan_id: plan.id,
  });
  if (txError) throw txError;
}

async function clearUserPlan(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ plan_id: null, plan_expires_at: null })
    .eq("id", userId);
  if (error) throw error;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ── Plan catalog management (admin/'s Subscriptions → "Manage plans") ──
// Separate from listPlans (active-only, used by the "Change plan" picker)
// since management needs to see and reactivate inactive plans too.

export interface PlanCatalogRow {
  id: string;
  name: string;
  price_inr: number;
  period_days: number;
  coins_included: number;
  description: string | null;
  benefits: string[];
  is_active: boolean;
}

export interface PlanInput {
  name: string;
  price_inr: number;
  period_days: number;
  coins_included: number;
  description: string;
  benefits: string[];
}

async function listAllPlans(): Promise<PlanCatalogRow[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_inr, period_days, coins_included, description, benefits, is_active")
    .order("price_inr", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanCatalogRow[];
}

async function createPlan(input: PlanInput): Promise<void> {
  const id = `plan_${slugify(input.name)}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("plans").insert({
    id,
    name: input.name,
    price_inr: input.price_inr,
    period_days: input.period_days,
    coins_included: input.coins_included,
    description: input.description || null,
    benefits: input.benefits,
  });
  if (error) throw error;
}

async function updatePlan(id: string, input: PlanInput): Promise<void> {
  const { error } = await supabase
    .from("plans")
    .update({
      name: input.name,
      price_inr: input.price_inr,
      period_days: input.period_days,
      coins_included: input.coins_included,
      description: input.description || null,
      benefits: input.benefits,
    })
    .eq("id", id);
  if (error) throw error;
}

async function setPlanActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("plans").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

// ── Top-up package catalog management ───────────────────────────────────

export interface TopUpCatalogRow {
  id: string;
  coins: number;
  price_inr: number;
  description: string | null;
  benefits: string[];
  is_popular: boolean;
  is_active: boolean;
}

export interface TopUpInput {
  coins: number;
  price_inr: number;
  description: string;
  benefits: string[];
  is_popular: boolean;
}

async function listAllTopUps(): Promise<TopUpCatalogRow[]> {
  const { data, error } = await supabase
    .from("topup_packages")
    .select("id, coins, price_inr, description, benefits, is_popular, is_active")
    .order("price_inr", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TopUpCatalogRow[];
}

async function createTopUp(input: TopUpInput): Promise<void> {
  const id = `topup_${input.coins}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("topup_packages").insert({
    id,
    coins: input.coins,
    price_inr: input.price_inr,
    description: input.description || null,
    benefits: input.benefits,
    is_popular: input.is_popular,
  });
  if (error) throw error;
}

async function updateTopUp(id: string, input: TopUpInput): Promise<void> {
  const { error } = await supabase
    .from("topup_packages")
    .update({
      coins: input.coins,
      price_inr: input.price_inr,
      description: input.description || null,
      benefits: input.benefits,
      is_popular: input.is_popular,
    })
    .eq("id", id);
  if (error) throw error;
}

async function setTopUpActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("topup_packages").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

export const adminSubscriptionsRepo = {
  listPlans,
  getSubscriptionSummary,
  listSubscribedUsers,
  setUserPlan,
  clearUserPlan,
  listAllPlans,
  createPlan,
  updatePlan,
  setPlanActive,
  listAllTopUps,
  createTopUp,
  updateTopUp,
  setTopUpActive,
};
