import "server-only";
import { supabase } from "../supabase";
import { parseSort } from "../sort";

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  wa_id: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  coin_balance: number;
  subscription_tier: string | null;
  blocked_at: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  plan_id: string | null;
  plan_expires_at: string | null;
  last_login: string | null;
  // Resolved through channel_links/accounts once this channel identity is
  // linked to a dashboard login (see server/db/schema.sql's "dashboard/
  // real accounts" block) — null/falls back to the legacy columns above
  // for anyone who hasn't linked. Every admin action (block, adjust
  // coins, change plan) reads and writes through these, not the raw
  // columns, so it works correctly either way.
  account_id: string | null;
  linked_account_email: string | null;
  effective_coin_balance: number;
  effective_blocked_at: string | null;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
}

export type UserStatusFilter = "active" | "blocked" | "trial" | "subscription" | "expired";

// Public (URL-facing) sort field name -> actual column. coin_balance/
// plan_expires_at map to their effective_* counterparts so sorting
// matches what the table actually displays for a linked user.
const SORTABLE_FIELDS: Record<string, string> = {
  coin_balance: "effective_coin_balance",
  plan_expires_at: "effective_plan_expires_at",
  created_at: "created_at",
};

export interface ListUsersParams {
  search?: string;
  status?: UserStatusFilter;
  expiresBefore?: string;
  expiresAfter?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

const USER_ROW_COLUMNS =
  "user_id, email, full_name, wa_id, telegram_id, telegram_chat_id, coin_balance, subscription_tier, blocked_at, marketing_opt_in, created_at, plan_id, plan_expires_at, last_login, account_id, linked_account_email, effective_coin_balance, effective_blocked_at, effective_plan_id, effective_plan_expires_at";

export interface Paginated<T> {
  rows: T[];
  total: number;
}

/** The general admin Users directory — one row per real person, never per
 * channel. Unlike AdminUserRow (which is `user_with_event`, keyed by a
 * channel identity — still correct for the detail page, which is always
 * reached via a specific channel's users.id), this is account-driven:
 * queries `accounts` directly (so a dashboard signup with zero linked
 * channels still shows up, and one linked to both WhatsApp and Telegram
 * shows up exactly once, however many channels it has), unioned with
 * `users` rows that have no channel_links row at all (someone who's
 * texted the bot but never linked/signed up). Same shape of fix already
 * applied to adminSubscriptions.repo.ts's listSubscribedUsers. */
export interface AdminUserListRow {
  id: string; // account_id (kind="account") or users.id (kind="unlinked_user") — row key and action target
  kind: "account" | "unlinked_user";
  // A users.id for the /users/<id> detail link and any channel-scoped
  // action (Send message, Low-balance alert) — any one linked channel for
  // an "account" row, itself for "unlinked_user", null for an account
  // with zero linked channels (nothing to view/message yet).
  detail_user_id: string | null;
  full_name: string | null;
  email: string | null;
  wa_id: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  channels: ("whatsapp" | "telegram")[];
  subscription_tier: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  last_login: string | null;
  effective_coin_balance: number;
  effective_blocked_at: string | null;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
}

interface RawAccount {
  id: string;
  full_name: string | null;
  email: string | null;
  coin_balance: number;
  blocked_at: string | null;
  plan_id: string | null;
  plan_expires_at: string | null;
  created_at: string;
}

interface RawChannelLink {
  account_id: string;
  users_id: string;
  channel: "whatsapp" | "telegram";
  channel_identifier: string;
}

interface RawLegacyUser {
  id: string;
  full_name: string | null;
  email: string | null;
  wa_id: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  coin_balance: number;
  blocked_at: string | null;
  plan_id: string | null;
  plan_expires_at: string | null;
  subscription_tier: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  last_login: string | null;
}

function matchesStatus(
  status: UserStatusFilter | undefined,
  blockedAt: string | null,
  planId: string | null,
  planExpiresAt: string | null,
  coinBalance: number,
  nowMs: number,
): boolean {
  switch (status) {
    case "blocked":
      return blockedAt !== null;
    case "active":
      return blockedAt === null;
    case "trial":
      return blockedAt === null && planId === null && coinBalance > 0;
    case "subscription":
      return blockedAt === null && planId !== null && !!planExpiresAt && new Date(planExpiresAt).getTime() > nowMs;
    case "expired":
      return blockedAt === null && planId !== null && !!planExpiresAt && new Date(planExpiresAt).getTime() <= nowMs;
    default:
      return true;
  }
}

function matchesExpiry(
  planId: string | null,
  planExpiresAt: string | null,
  expiresBefore?: string,
  expiresAfter?: string,
): boolean {
  if ((expiresBefore || expiresAfter) && (planId === null || !planExpiresAt)) return false;
  if (expiresBefore && new Date(planExpiresAt!).getTime() > new Date(expiresBefore).getTime()) return false;
  if (expiresAfter && new Date(planExpiresAt!).getTime() < new Date(expiresAfter).getTime()) return false;
  return true;
}

function matchesSearch(term: string, fields: (string | null)[]): boolean {
  const needle = term.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

async function listUsers({
  search,
  status,
  expiresBefore,
  expiresAfter,
  sort,
  page,
  pageSize,
}: ListUsersParams): Promise<Paginated<AdminUserListRow>> {
  const [{ data: accounts, error: accErr }, { data: links, error: linkErr }, { data: legacyUsers, error: userErr }] =
    await Promise.all([
      supabase.from("accounts").select("id, full_name, email, coin_balance, blocked_at, plan_id, plan_expires_at, created_at"),
      supabase.from("channel_links").select("account_id, users_id, channel, channel_identifier"),
      supabase
        .from("users")
        .select(
          "id, full_name, email, wa_id, telegram_id, telegram_chat_id, coin_balance, blocked_at, plan_id, plan_expires_at, subscription_tier, marketing_opt_in, created_at, last_login",
        ),
    ]);
  if (accErr) throw accErr;
  if (linkErr) throw linkErr;
  if (userErr) throw userErr;

  const linksByAccount = new Map<string, RawChannelLink[]>();
  const linkedUsersIds = new Set<string>();
  for (const link of (links ?? []) as RawChannelLink[]) {
    const arr = linksByAccount.get(link.account_id) ?? [];
    arr.push(link);
    linksByAccount.set(link.account_id, arr);
    linkedUsersIds.add(link.users_id);
  }

  const term = search?.trim();
  const nowMs = Date.now();

  const accountRows: AdminUserListRow[] = ((accounts ?? []) as RawAccount[])
    .filter((a) => matchesStatus(status, a.blocked_at, a.plan_id, a.plan_expires_at, a.coin_balance, nowMs))
    .filter((a) => matchesExpiry(a.plan_id, a.plan_expires_at, expiresBefore, expiresAfter))
    .filter((a) => !term || matchesSearch(term, [a.email, a.full_name]))
    .map((a) => {
      const accountLinks = linksByAccount.get(a.id) ?? [];
      const waLink = accountLinks.find((l) => l.channel === "whatsapp");
      const tgLink = accountLinks.find((l) => l.channel === "telegram");
      return {
        id: a.id,
        kind: "account" as const,
        detail_user_id: accountLinks[0]?.users_id ?? null,
        full_name: a.full_name,
        email: a.email,
        wa_id: waLink?.channel_identifier ?? null,
        telegram_id: tgLink?.channel_identifier ?? null,
        telegram_chat_id: tgLink?.channel_identifier ?? null,
        channels: accountLinks.map((l) => l.channel),
        subscription_tier: null,
        marketing_opt_in: false,
        created_at: a.created_at,
        last_login: null,
        effective_coin_balance: a.coin_balance,
        effective_blocked_at: a.blocked_at,
        effective_plan_id: a.plan_id,
        effective_plan_expires_at: a.plan_expires_at,
      };
    });

  const unlinkedRows: AdminUserListRow[] = ((legacyUsers ?? []) as RawLegacyUser[])
    .filter((u) => !linkedUsersIds.has(u.id))
    .filter((u) => matchesStatus(status, u.blocked_at, u.plan_id, u.plan_expires_at, u.coin_balance, nowMs))
    .filter((u) => matchesExpiry(u.plan_id, u.plan_expires_at, expiresBefore, expiresAfter))
    .filter((u) => !term || matchesSearch(term, [u.email, u.full_name, u.wa_id, u.telegram_id]))
    .map((u) => ({
      id: u.id,
      kind: "unlinked_user" as const,
      detail_user_id: u.id,
      full_name: u.full_name,
      email: u.email,
      wa_id: u.wa_id,
      telegram_id: u.telegram_id,
      telegram_chat_id: u.telegram_chat_id,
      channels: [u.wa_id ? "whatsapp" : null, u.telegram_id ? "telegram" : null].filter(
        (c): c is "whatsapp" | "telegram" => c !== null,
      ),
      subscription_tier: u.subscription_tier,
      marketing_opt_in: u.marketing_opt_in,
      created_at: u.created_at,
      last_login: u.last_login,
      effective_coin_balance: u.coin_balance,
      effective_blocked_at: u.blocked_at,
      effective_plan_id: u.plan_id,
      effective_plan_expires_at: u.plan_expires_at,
    }));

  const allRows = [...accountRows, ...unlinkedRows];

  const parsedSort = parseSort(sort);
  const sortField = parsedSort && SORTABLE_FIELDS[parsedSort.field] ? parsedSort.field : "created_at";
  const ascending = parsedSort?.ascending ?? false;
  allRows.sort((a, b) => {
    const av = sortField === "coin_balance" ? a.effective_coin_balance : sortField === "plan_expires_at" ? a.effective_plan_expires_at : a.created_at;
    const bv = sortField === "coin_balance" ? b.effective_coin_balance : sortField === "plan_expires_at" ? b.effective_plan_expires_at : b.created_at;
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return ascending ? cmp : -cmp;
  });

  const from = (page - 1) * pageSize;
  return { rows: allRows.slice(from, from + pageSize), total: allRows.length };
}

async function getUserDetail(userId: string): Promise<AdminUserRow | null> {
  const { data, error } = await supabase
    .from("user_with_event")
    .select(USER_ROW_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as AdminUserRow | null;
}

async function getUserEvents(userId: string) {
  const [{ data: events, error: eventsError }, { data: cards, error: cardsError }] = await Promise.all([
    supabase.from("events").select("id, name, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("visiting_cards").select("id, event_id").eq("user_id", userId),
  ]);
  if (eventsError) throw eventsError;
  if (cardsError) throw cardsError;

  const counts = new Map<string, number>();
  for (const card of cards ?? []) {
    if (!card.event_id) continue;
    counts.set(card.event_id, (counts.get(card.event_id) ?? 0) + 1);
  }

  return (events ?? []).map((event) => ({ ...event, cardCount: counts.get(event.id) ?? 0 }));
}

async function getUserCards(userId: string) {
  const { data, error } = await supabase
    .from("visiting_cards")
    .select("id, full_name, company_name, uploaded_by, extraction_confidence, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Dashboard-originated purchases (subscribe/top-up from the dashboard or a
 * bot-issued magic-login link) are stored with account_id set and user_id
 * null — filtering on user_id alone silently hid every one of them once a
 * channel got linked. Matches either. */
async function getUserTransactions(userId: string) {
  const accountId = await resolveAccountId(userId);
  const filter = accountId ? `user_id.eq.${userId},account_id.eq.${accountId}` : `user_id.eq.${userId}`;
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, coins, status, created_at")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/** Resolves the dashboard account this channel identity is linked to, if
 * any — every action below branches on this, updating whichever table
 * actually owns the wallet/block state for this user right now (see the
 * effective_* columns' coalesce logic in the user_with_event view). */
async function resolveAccountId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("channel_links")
    .select("account_id")
    .eq("users_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.account_id ?? null;
}

async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const accountId = await resolveAccountId(userId);
  const blockedAt = blocked ? new Date().toISOString() : null;
  if (accountId) {
    const { error } = await supabase.from("accounts").update({ blocked_at: blockedAt }).eq("id", accountId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("users").update({ blocked_at: blockedAt }).eq("id", userId);
  if (error) throw error;
}

/** Same as setBlocked, entered directly with an accountId instead of
 * resolving one from a channel identity — for the Users directory's
 * "account" rows, which always know their accountId already (see
 * listUsers) and may have zero linked channels to resolve through. */
async function setAccountBlocked(accountId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq("id", accountId);
  if (error) throw error;
}

export interface InteractionEvent {
  at: string;
  kind: "scan" | "notification";
  // scan
  cardName?: string | null;
  channel?: string | null;
  // notification
  notificationType?: string;
  notificationStatus?: string;
}

const INTERACTION_HISTORY_LIMIT = 30;

/** Merges two already-existing data sources into one chronological feed —
 * no new table, just card scans (getUserCards) and notifications sent to
 * this user (notification_log, same shape adminNotificationsRepo.
 * listNotificationLog already returns), sorted together. */
async function getUserInteractionHistory(userId: string): Promise<InteractionEvent[]> {
  const [cards, { data: notifications, error }] = await Promise.all([
    getUserCards(userId),
    supabase
      .from("notification_log")
      .select("id, type, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(INTERACTION_HISTORY_LIMIT),
  ]);
  if (error) throw error;

  const scanEvents: InteractionEvent[] = cards.map((c) => ({
    at: c.created_at,
    kind: "scan",
    cardName: c.full_name || c.company_name,
    channel: c.uploaded_by,
  }));
  const notificationEvents: InteractionEvent[] = (notifications ?? []).map((n) => ({
    at: n.created_at,
    kind: "notification",
    notificationType: n.type,
    notificationStatus: n.status,
  }));

  return [...scanEvents, ...notificationEvents]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, INTERACTION_HISTORY_LIMIT);
}

// marketing_opt_in lives on `users` (per channel identity) even for a
// linked account, unlike blocked_at/coin_balance — see users.repo.ts's
// setMarketingOptIn in server/. No accountId indirection needed here.
async function setMarketingOptIn(userId: string, optIn: boolean): Promise<void> {
  const { error } = await supabase.from("users").update({ marketing_opt_in: optIn }).eq("id", userId);
  if (error) throw error;
}

async function adjustCoins(userId: string, delta: number, reason: string) {
  const accountId = await resolveAccountId(userId);
  if (accountId) {
    const { data, error } = await supabase.rpc("admin_adjust_account_coin_balance", {
      account_uuid: accountId,
      delta,
      reason,
    });
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.rpc("admin_adjust_coin_balance", {
    user_uuid: userId,
    delta,
    reason,
  });
  if (error) throw error;
  return data;
}

/** Same as adjustCoins, entered directly with an accountId — see
 * setAccountBlocked's comment. */
async function adjustAccountCoins(accountId: string, delta: number, reason: string) {
  const { data, error } = await supabase.rpc("admin_adjust_account_coin_balance", {
    account_uuid: accountId,
    delta,
    reason,
  });
  if (error) throw error;
  return data;
}

export const adminUsersRepo = {
  listUsers,
  getUserDetail,
  getUserEvents,
  getUserCards,
  getUserTransactions,
  getUserInteractionHistory,
  setBlocked,
  setAccountBlocked,
  setMarketingOptIn,
  adjustCoins,
  adjustAccountCoins,
};
