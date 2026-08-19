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

/** users.id values that already have a channel_links row (any channel) —
 * used to find the legacy-only subscribers below: a `users` row can carry
 * its own plan_id/plan_expires_at (pre-account-model fallback columns,
 * see user_with_event's effective_plan_id) with no account and no
 * channel_links row at all. Everyone else's plan lives on `accounts`,
 * queried directly so an account linked to 2 channels is never
 * counted/listed twice. */
async function linkedUsersIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("channel_links").select("users_id");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.users_id));
}

async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const [accountsRes, legacyUsersRes, earningRes, linked] = await Promise.all([
    supabase.from("accounts").select("plan_expires_at").not("plan_id", "is", null),
    supabase.from("users").select("id, plan_expires_at").not("plan_id", "is", null),
    supabase
      .from("transactions")
      .select("amount_inr")
      .eq("type", "subscription_payment")
      .eq("status", "completed"),
    linkedUsersIds(),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (legacyUsersRes.error) throw legacyUsersRes.error;
  if (earningRes.error) throw earningRes.error;

  const legacyOnly = (legacyUsersRes.data ?? []).filter((u) => !linked.has(u.id));
  const all = [...(accountsRes.data ?? []), ...legacyOnly];
  const active = all.filter((r) => r.plan_expires_at && new Date(r.plan_expires_at).getTime() > Date.now()).length;
  const totalEarningInr = (earningRes.data ?? []).reduce((sum, row) => sum + Number(row.amount_inr ?? 0), 0);

  return {
    totalSubscribed: all.length,
    active,
    expired: all.length - active,
    totalEarningInr,
  };
}

export interface SubscribedUserRow {
  /** Row key: an account_id (kind "account") or a legacy users.id (kind
   * "legacy_user" — a plan set directly on `users` with no account at all). */
  id: string;
  kind: "account" | "legacy_user";
  full_name: string | null;
  email: string | null;
  wa_id: string | null;
  /** /users/<id> link target — any one of the account's linked channel
   * identities (the admin app's only detail page is per-channel-identity,
   * not per-account); null when there's no linked channel to view at all. */
  detail_user_id: string | null;
  /** users.id of the WhatsApp-linked channel specifically — sendRenewalReminderAction
   * needs a WhatsApp identity to message, which a Telegram-only link can't provide. */
  reminder_user_id: string | null;
  plan_id: string;
  plan_expires_at: string | null;
  channels: ("whatsapp" | "telegram")[];
}

/** One row per real subscriber — an account (regardless of how many
 * channels it has linked, 0/1/2) or a legacy-only users row with its own
 * plan and no account. Small admin scale — fetching all and sorting/
 * paginating in-memory, same tradeoff this file already used before. */
async function listSubscribedUsers(page: number, pageSize: number): Promise<Paginated<SubscribedUserRow>> {
  const [{ data: accounts, error: accErr }, { data: links, error: linkErr }, { data: legacyUsers, error: userErr }, linked] =
    await Promise.all([
      supabase.from("accounts").select("id, full_name, email, plan_id, plan_expires_at").not("plan_id", "is", null),
      supabase.from("channel_links").select("account_id, users_id, channel, channel_identifier"),
      supabase.from("users").select("id, full_name, email, wa_id, plan_id, plan_expires_at").not("plan_id", "is", null),
      linkedUsersIds(),
    ]);
  if (accErr) throw accErr;
  if (linkErr) throw linkErr;
  if (userErr) throw userErr;

  const linksByAccount = new Map<string, typeof links>();
  for (const link of links ?? []) {
    const arr = linksByAccount.get(link.account_id) ?? [];
    arr.push(link);
    linksByAccount.set(link.account_id, arr);
  }

  const accountRows: SubscribedUserRow[] = (accounts ?? []).map((a) => {
    const accountLinks = linksByAccount.get(a.id) ?? [];
    const waLink = accountLinks.find((l) => l.channel === "whatsapp");
    return {
      id: a.id,
      kind: "account",
      full_name: a.full_name,
      email: a.email,
      wa_id: waLink?.channel_identifier ?? null,
      detail_user_id: accountLinks[0]?.users_id ?? null,
      reminder_user_id: waLink?.users_id ?? null,
      plan_id: a.plan_id as string,
      plan_expires_at: a.plan_expires_at,
      channels: accountLinks.map((l) => l.channel as "whatsapp" | "telegram"),
    };
  });

  const legacyRows: SubscribedUserRow[] = (legacyUsers ?? [])
    .filter((u) => !linked.has(u.id))
    .map((u) => ({
      id: u.id,
      kind: "legacy_user",
      full_name: u.full_name,
      email: u.email,
      wa_id: u.wa_id,
      detail_user_id: u.id,
      reminder_user_id: u.wa_id ? u.id : null,
      plan_id: u.plan_id as string,
      plan_expires_at: u.plan_expires_at,
      channels: u.wa_id ? (["whatsapp"] as const) : [],
    }));

  const allRows = [...accountRows, ...legacyRows].sort((x, y) => {
    if (!x.plan_expires_at) return 1;
    if (!y.plan_expires_at) return -1;
    return new Date(x.plan_expires_at).getTime() - new Date(y.plan_expires_at).getTime();
  });

  const from = (page - 1) * pageSize;
  return { rows: allRows.slice(from, from + pageSize), total: allRows.length };
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
 * as setUserPlan's linked-account branch and directly by the unified
 * Subscribed Users table for any "account" kind row (see
 * listSubscribedUsers), regardless of how many channels it has linked. */
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
