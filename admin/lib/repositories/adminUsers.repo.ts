import "server-only";
import { supabase } from "../supabase";
import { parseSort } from "../sort";

/** The detail page's row shape — account-aware, unlike the old
 * user_with_event-keyed version this replaced. `id` is whatever the route
 * was reached with (an accountId for "account" kind, a bare users.id for
 * "unlinked_user"); `email`/`full_name` are the real account's when
 * linked, not a channel identity's own (almost always blank) columns;
 * `userIds` is every linked channel identity — Events/Cards/Transactions/
 * Interaction-history all query across the whole list, so a dual-linked
 * account's WhatsApp *and* Telegram activity both show up. */
export interface AdminUserDetail {
  id: string;
  kind: "account" | "unlinked_user";
  full_name: string | null;
  email: string | null;
  channels: { channel: "whatsapp" | "telegram"; identifier: string; usersId: string }[];
  userIds: string[];
  subscription_tier: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  last_login: string | null;
  effective_coin_balance: number;
  effective_blocked_at: string | null;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
}

export type UserStatusFilter = "active" | "blocked" | "trial" | "subscription" | "expired" | "needs_info";

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
  // Every linked users.id (account, 0/1/2 entries) or just [id] (unlinked_user)
  // — what the Cards page's "view this person's cards" filter needs, since a
  // dual-channel account's scans are split across two channel identities.
  userIds: string[];
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
  unlinked_at: string | null;
}

function matchesStatus(
  status: UserStatusFilter | undefined,
  blockedAt: string | null,
  planId: string | null,
  planExpiresAt: string | null,
  coinBalance: number,
  nowMs: number,
  fullName: string | null,
  email: string | null,
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
    // No name AND no email — near-impossible to identify or support this
    // person; worth a dedicated filter to find them for merge/enrichment.
    case "needs_info":
      return !fullName && !email;
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

export type ListUsersFilterParams = Omit<ListUsersParams, "page" | "pageSize">;

/** Fetches + filters + sorts every matching row, unpaginated — shared by
 * listUsers (which slices a page off the end) and listUsersForExport
 * (which returns everything, for a CSV that matches the current filters
 * exactly, not just what's on screen). Account rows only — someone who's
 * only ever messaged the bot and never completed signup has no `accounts`
 * row at all, so they don't belong in a directory of real users; that raw
 * channel identity is still reachable directly at /users/<usersId> (e.g.
 * from a card's uploader) via getUserDetail's unlinked_user fallback. */
async function buildFilteredUserRows({
  search,
  status,
  expiresBefore,
  expiresAfter,
  sort,
}: ListUsersFilterParams): Promise<AdminUserListRow[]> {
  const [{ data: accounts, error: accErr }, { data: links, error: linkErr }] = await Promise.all([
    supabase.from("accounts").select("id, full_name, email, coin_balance, blocked_at, plan_id, plan_expires_at, created_at"),
    supabase.from("channel_links").select("account_id, users_id, channel, channel_identifier, unlinked_at"),
  ]);
  if (accErr) throw accErr;
  if (linkErr) throw linkErr;

  // linksByAccount is the *display* list (channel badges, wa_id/telegram_id
  // shown on the account row) and only ever shows currently-active channels
  // — a disconnected-but-still-linked channel stays attributed to the
  // account (not dropped) elsewhere, this map just isn't where that shows.
  const linksByAccount = new Map<string, RawChannelLink[]>();
  for (const link of (links ?? []) as RawChannelLink[]) {
    if (link.unlinked_at !== null) continue;
    const arr = linksByAccount.get(link.account_id) ?? [];
    arr.push(link);
    linksByAccount.set(link.account_id, arr);
  }

  const term = search?.trim();
  const nowMs = Date.now();

  const accountRows: AdminUserListRow[] = ((accounts ?? []) as RawAccount[])
    .filter((a) => matchesStatus(status, a.blocked_at, a.plan_id, a.plan_expires_at, a.coin_balance, nowMs, a.full_name, a.email))
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
        userIds: accountLinks.map((l) => l.users_id),
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

  const allRows = accountRows;

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

  return allRows;
}

async function listUsers(params: ListUsersParams): Promise<Paginated<AdminUserListRow>> {
  const allRows = await buildFilteredUserRows(params);
  const from = (params.page - 1) * params.pageSize;
  return { rows: allRows.slice(from, from + params.pageSize), total: allRows.length };
}

async function listUsersForExport(params: ListUsersFilterParams): Promise<AdminUserListRow[]> {
  return buildFilteredUserRows(params);
}

/** `id` is whatever the route was reached with — tries it as an accountId
 * first (the common case: UsersTable now links via row.id, an accountId
 * for "account" kind rows), falling back to a bare users.id for
 * "unlinked_user" rows. See AdminUserDetail's doc comment for why this
 * replaced the old user_with_event-keyed version. */
async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, full_name, email, coin_balance, blocked_at, plan_id, plan_expires_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (accErr) throw accErr;

  if (account) {
    const { data: links, error: linkErr } = await supabase
      .from("channel_links")
      .select("users_id, channel, channel_identifier")
      .eq("account_id", account.id);
    if (linkErr) throw linkErr;

    const userIds = (links ?? []).map((l) => l.users_id);
    let marketingOptIn = false;
    if (userIds.length > 0) {
      const { data: linkedUsers, error: usersErr } = await supabase.from("users").select("marketing_opt_in").in("id", userIds);
      if (usersErr) throw usersErr;
      // All-or-nothing, same convention as the dashboard's own account-wide
      // preference toggle (server/'s GET /auth/me) — keeps the "does this
      // account want marketing" answer consistent across the app.
      marketingOptIn = (linkedUsers ?? []).length > 0 && (linkedUsers ?? []).every((u) => u.marketing_opt_in);
    }

    return {
      id: account.id,
      kind: "account",
      full_name: account.full_name,
      email: account.email,
      channels: (links ?? []).map((l) => ({ channel: l.channel, identifier: l.channel_identifier, usersId: l.users_id })),
      userIds,
      subscription_tier: null,
      marketing_opt_in: marketingOptIn,
      created_at: account.created_at,
      last_login: null,
      effective_coin_balance: account.coin_balance,
      effective_blocked_at: account.blocked_at,
      effective_plan_id: account.plan_id,
      effective_plan_expires_at: account.plan_expires_at,
    };
  }

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select(
      "id, full_name, email, wa_id, telegram_id, telegram_chat_id, coin_balance, blocked_at, plan_id, plan_expires_at, subscription_tier, marketing_opt_in, created_at, last_login",
    )
    .eq("id", id)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user) return null;

  const channels: AdminUserDetail["channels"] = [];
  if (user.wa_id) channels.push({ channel: "whatsapp", identifier: user.wa_id, usersId: user.id });
  // identifier is chat_id (falling back to telegram_id) — what sending
  // actually needs; the two are equal for almost every user, differing
  // only for group/topic chats (see users.repo.ts in server/).
  if (user.telegram_id) channels.push({ channel: "telegram", identifier: user.telegram_chat_id || user.telegram_id, usersId: user.id });

  return {
    id: user.id,
    kind: "unlinked_user",
    full_name: user.full_name,
    email: user.email,
    channels,
    userIds: [user.id],
    subscription_tier: user.subscription_tier,
    marketing_opt_in: user.marketing_opt_in,
    created_at: user.created_at,
    last_login: user.last_login,
    effective_coin_balance: user.coin_balance,
    effective_blocked_at: user.blocked_at,
    effective_plan_id: user.plan_id,
    effective_plan_expires_at: user.plan_expires_at,
  };
}

async function getUserEvents(userIds: string[]) {
  if (userIds.length === 0) return [];
  const [{ data: events, error: eventsError }, { data: cards, error: cardsError }] = await Promise.all([
    supabase.from("events").select("id, name, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
    supabase.from("visiting_cards").select("id, event_id").in("user_id", userIds),
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

async function getUserCards(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("visiting_cards")
    .select("id, full_name, company_name, uploaded_by, extraction_confidence, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Dashboard-originated purchases (subscribe/top-up from the dashboard or a
 * bot-issued magic-login link) are stored with account_id set and user_id
 * null — filtering on user_id alone silently hid every one of them once a
 * channel got linked. Matches either, across every linked channel identity
 * plus the account itself. */
async function getUserTransactions(userIds: string[], accountId?: string | null) {
  if (userIds.length === 0 && !accountId) return [];
  const parts = userIds.map((id) => `user_id.eq.${id}`);
  if (accountId) parts.push(`account_id.eq.${accountId}`);
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, coins, status, created_at")
    .or(parts.join(","))
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
async function getUserInteractionHistory(userIds: string[]): Promise<InteractionEvent[]> {
  if (userIds.length === 0) return [];
  const [cards, { data: notifications, error }] = await Promise.all([
    getUserCards(userIds),
    supabase
      .from("notification_log")
      .select("id, type, status, created_at")
      .in("user_id", userIds)
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

/** Same as setMarketingOptIn, applied to every channel linked to an
 * account at once — mirrors setMarketingOptInForAccount already built
 * server-side for the dashboard's own preference toggle (server/src/
 * services/channelLinkService.ts), so an "account" kind detail-page row
 * toggles consistently across however many channels it has linked. */
async function setAccountMarketingOptIn(accountId: string, optIn: boolean): Promise<void> {
  const { data: links, error: linkErr } = await supabase.from("channel_links").select("users_id").eq("account_id", accountId);
  if (linkErr) throw linkErr;
  if (!links || links.length === 0) return;

  const { error } = await supabase
    .from("users")
    .update({ marketing_opt_in: optIn })
    .in(
      "id",
      links.map((l) => l.users_id),
    );
  if (error) throw error;
}

async function updateUserProfile(userId: string, patch: { full_name?: string; email?: string | null }): Promise<void> {
  const { error } = await supabase.from("users").update(patch).eq("id", userId);
  if (error) throw error;
}

/** Same as updateUserProfile, entered directly with an accountId — see
 * setAccountBlocked's comment for why "account" kind rows need their own
 * entry point instead of resolving through a channel identity. */
async function updateAccountProfile(accountId: string, patch: { full_name?: string; email?: string | null }): Promise<void> {
  const { error } = await supabase.from("accounts").update(patch).eq("id", accountId);
  if (error) throw error;
}

/** Deletes a bare `users` row (an "unlinked_user" row, or one of an
 * account's linked channel identities). `events.user_id`/
 * `visiting_cards.user_id` are both ON DELETE CASCADE from `users`, so
 * this unconditionally deletes that channel identity's events and cards
 * too — there is no non-destructive alternative at the schema level. The
 * UI's "also delete N events, M cards" checkbox for this row kind is
 * therefore a confirmation gate, not a real branch — it must stay
 * checked before the caller ever reaches this function. */
async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}

/** Deletes an "account" row. Unlike deleteUser, this does NOT cascade to
 * events/cards on its own — neither table has an FK to `accounts`, only
 * to `users` — so by default this only removes the account + unlinks its
 * channels + kills its sessions/invoices (all ON DELETE CASCADE from
 * accounts), leaving the underlying `users` row(s) and their events/cards
 * fully intact and reachable again as separate "unlinked_user" rows.
 * `alsoDeleteLinkedUsersData: true` is the real branch the UI checkbox
 * controls: it deletes the linked `users` row(s) too, which *then*
 * cascades their events/cards via deleteUser's mechanism. */
async function deleteAccount(accountId: string, alsoDeleteLinkedUsersData: boolean): Promise<void> {
  if (alsoDeleteLinkedUsersData) {
    const { data: links, error: linkErr } = await supabase.from("channel_links").select("users_id").eq("account_id", accountId);
    if (linkErr) throw linkErr;
    const usersIds = (links ?? []).map((l) => l.users_id);
    if (usersIds.length > 0) {
      const { error: usersErr } = await supabase.from("users").delete().in("id", usersIds);
      if (usersErr) throw usersErr;
    }
  }
  // Belt-and-suspenders alongside the transactions.account_id FK fix
  // (schema.sql) — doesn't depend on that migration having landed yet.
  const { error: txErr } = await supabase.from("transactions").update({ account_id: null }).eq("account_id", accountId);
  if (txErr) throw txErr;

  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
}

async function bulkDeleteUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("users").delete().in("id", userIds);
  if (error) throw error;
}

async function bulkDeleteAccounts(accountIds: string[], alsoDeleteLinkedUsersData: boolean): Promise<void> {
  for (const accountId of accountIds) {
    // eslint-disable-next-line no-await-in-loop -- each delete can cascade
    // (channel_links/sessions/invoices, and optionally users/events/cards);
    // running these concurrently risks interleaved partial cascades across
    // rows that might share state, so this stays sequential.
    await deleteAccount(accountId, alsoDeleteLinkedUsersData);
  }
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
  listUsersForExport,
  getUserDetail,
  getUserEvents,
  getUserCards,
  getUserTransactions,
  getUserInteractionHistory,
  setBlocked,
  setAccountBlocked,
  setMarketingOptIn,
  setAccountMarketingOptIn,
  adjustCoins,
  adjustAccountCoins,
  updateUserProfile,
  updateAccountProfile,
  deleteUser,
  deleteAccount,
  bulkDeleteUsers,
  bulkDeleteAccounts,
};
