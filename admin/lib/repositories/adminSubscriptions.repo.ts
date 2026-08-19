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

/** account_ids that already have a linked channel — used to exclude them
 * from the unlinked-accounts-only queries below, since a linked
 * account's plan is already fully represented via user_with_event's
 * effective_plan_id (resolve-through, not re-keyed — see
 * adminUsers.repo.ts). Without this exclusion, a linked subscriber would
 * get counted/listed twice: once as a channel identity, once as an account. */
async function linkedAccountIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("channel_links").select("account_id");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.account_id));
}

async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const nowIso = new Date().toISOString();

  const [totalRes, activeRes, expiredRes, earningRes, accounts, linked] = await Promise.all([
    supabase.from("user_with_event").select("*", { count: "exact", head: true }).not("effective_plan_id", "is", null),
    supabase
      .from("user_with_event")
      .select("*", { count: "exact", head: true })
      .not("effective_plan_id", "is", null)
      .gt("effective_plan_expires_at", nowIso),
    supabase
      .from("user_with_event")
      .select("*", { count: "exact", head: true })
      .not("effective_plan_id", "is", null)
      .lte("effective_plan_expires_at", nowIso),
    supabase
      .from("transactions")
      .select("amount_inr")
      .eq("type", "subscription_payment")
      .eq("status", "completed"),
    supabase.from("accounts").select("id, plan_id, plan_expires_at").not("plan_id", "is", null),
    linkedAccountIds(),
  ]);

  if (totalRes.error) throw totalRes.error;
  if (activeRes.error) throw activeRes.error;
  if (expiredRes.error) throw expiredRes.error;
  if (earningRes.error) throw earningRes.error;
  if (accounts.error) throw accounts.error;

  const totalEarningInr = (earningRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0,
  );

  // Accounts with a plan but no linked channel at all — the only
  // subscribers not already reachable via user_with_event.
  const unlinkedAccounts = (accounts.data ?? []).filter((a) => !linked.has(a.id));
  const unlinkedActive = unlinkedAccounts.filter(
    (a) => a.plan_expires_at && new Date(a.plan_expires_at).getTime() > Date.now(),
  ).length;

  return {
    totalSubscribed: (totalRes.count ?? 0) + unlinkedAccounts.length,
    active: (activeRes.count ?? 0) + unlinkedActive,
    expired: (expiredRes.count ?? 0) + (unlinkedAccounts.length - unlinkedActive),
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

// Channel identities (bot users) with a plan — resolved through
// effective_plan_id, so this already covers both legacy-only users and
// users whose plan actually lives on a linked account.
async function listSubscribedUsers(page: number, pageSize: number): Promise<Paginated<SubscribedUserRow>> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("user_with_event")
    .select("user_id, full_name, email, wa_id, effective_plan_id, effective_plan_expires_at", { count: "exact" })
    .not("effective_plan_id", "is", null)
    .order("effective_plan_expires_at", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    wa_id: row.wa_id,
    plan_id: row.effective_plan_id,
    plan_expires_at: row.effective_plan_expires_at,
  }));
  return { rows, total: count ?? 0 };
}

export interface SubscribedAccountRow {
  account_id: string;
  full_name: string | null;
  email: string | null;
  plan_id: string;
  plan_expires_at: string | null;
}

/** Accounts with a plan but no linked channel — invisible to
 * listSubscribedUsers above (which is keyed by channel identity), so this
 * is the only place they show up. Small admin scale — fetching all and
 * filtering client-side is fine here, same tradeoff as
 * getSubscriptionSummary's linkedAccountIds() call. */
async function listSubscribedAccounts(page: number, pageSize: number): Promise<Paginated<SubscribedAccountRow>> {
  const [{ data, error }, linked] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, full_name, email, plan_id, plan_expires_at")
      .not("plan_id", "is", null)
      .order("plan_expires_at", { ascending: true }),
    linkedAccountIds(),
  ]);
  if (error) throw error;

  const unlinked = (data ?? []).filter((a) => !linked.has(a.id));
  const from = (page - 1) * pageSize;
  const rows = unlinked.slice(from, from + pageSize).map((a) => ({
    account_id: a.id,
    full_name: a.full_name,
    email: a.email,
    plan_id: a.plan_id as string,
    plan_expires_at: a.plan_expires_at,
  }));
  return { rows, total: unlinked.length };
}

async function resolveAccountId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("account_id")
    .eq("users_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.account_id ?? null;
}

/** Admin-manual "Change plan" action — no real checkout yet (see
 * docs/ADMIN_APP.md), so this both sets the plan/expiry and logs the
 * payment in one step. Extends from the current expiry if it's still in
 * the future (a renewal), otherwise starts fresh from now. Targets
 * whichever table currently owns this user's wallet/plan — accounts if
 * this channel is linked, else the legacy users columns unchanged. */
async function setUserPlan(userId: string, plan: Plan): Promise<void> {
  const accountId = await resolveAccountId(userId);
  if (accountId) {
    await setAccountPlan(accountId, plan);
    return;
  }

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
  const accountId = await resolveAccountId(userId);
  if (accountId) {
    await clearAccountPlan(accountId);
    return;
  }
  const { error } = await supabase
    .from("users")
    .update({ plan_id: null, plan_expires_at: null })
    .eq("id", userId);
  if (error) throw error;
}

/** Same logic as setUserPlan, targeting an account directly — used both
 * as setUserPlan's linked-account branch and directly by the Subscribed
 * Accounts section (accounts with no linked channel at all). */
async function setAccountPlan(accountId: string, plan: Plan): Promise<void> {
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("plan_expires_at")
    .eq("id", accountId)
    .single();
  if (accountError) throw accountError;

  const base =
    account.plan_expires_at && new Date(account.plan_expires_at).getTime() > Date.now()
      ? new Date(account.plan_expires_at)
      : new Date();
  const expiresAt = new Date(base.getTime() + plan.period_days * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("accounts")
    .update({ plan_id: plan.id, plan_expires_at: expiresAt.toISOString() })
    .eq("id", accountId);
  if (updateError) throw updateError;

  if (plan.coins_included > 0) {
    const { error: coinsError } = await supabase.rpc("account_increment_coin_balance", {
      account_uuid: accountId,
      amount: plan.coins_included,
    });
    if (coinsError) throw coinsError;
  }

  const { error: txError } = await supabase.from("transactions").insert({
    account_id: accountId,
    type: "subscription_payment",
    coins: plan.coins_included,
    status: "completed",
    amount_inr: plan.price_inr,
    plan_id: plan.id,
  });
  if (txError) throw txError;
}

async function clearAccountPlan(accountId: string): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ plan_id: null, plan_expires_at: null })
    .eq("id", accountId);
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
  listSubscribedAccounts,
  setUserPlan,
  clearUserPlan,
  setAccountPlan,
  clearAccountPlan,
  listAllPlans,
  createPlan,
  updatePlan,
  setPlanActive,
  listAllTopUps,
  createTopUp,
  updateTopUp,
  setTopUpActive,
};
