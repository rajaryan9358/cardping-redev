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
}

export type UserStatusFilter = "active" | "blocked" | "trial" | "subscription" | "expired";

const SORTABLE_FIELDS = new Set(["coin_balance", "plan_expires_at", "created_at"]);

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
  "user_id, email, full_name, wa_id, telegram_id, telegram_chat_id, coin_balance, subscription_tier, blocked_at, marketing_opt_in, created_at, plan_id, plan_expires_at, last_login";

export interface Paginated<T> {
  rows: T[];
  total: number;
}

async function listUsers({
  search,
  status,
  expiresBefore,
  expiresAfter,
  sort,
  page,
  pageSize,
}: ListUsersParams): Promise<Paginated<AdminUserRow>> {
  let query = supabase.from("user_with_event").select(USER_ROW_COLUMNS, { count: "exact" });

  const parsedSort = parseSort(sort);
  if (parsedSort && SORTABLE_FIELDS.has(parsedSort.field)) {
    query = query.order(parsedSort.field, { ascending: parsedSort.ascending });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const term = search?.trim();
  if (term) {
    query = query.or(
      `email.ilike.%${term}%,full_name.ilike.%${term}%,wa_id.ilike.%${term}%,telegram_id.ilike.%${term}%`,
    );
  }

  const nowIso = new Date().toISOString();
  switch (status) {
    case "blocked":
      query = query.not("blocked_at", "is", null);
      break;
    case "active":
      query = query.is("blocked_at", null);
      break;
    case "trial":
      query = query.is("blocked_at", null).is("plan_id", null).gt("coin_balance", 0);
      break;
    case "subscription":
      query = query.is("blocked_at", null).not("plan_id", "is", null).gt("plan_expires_at", nowIso);
      break;
    case "expired":
      query = query.is("blocked_at", null).not("plan_id", "is", null).lte("plan_expires_at", nowIso);
      break;
  }

  // Independent of `status` — finds anyone renewal-worthy regardless of
  // which tab is active, via the quick "Expiring ≤Nd" buttons or a
  // custom date range.
  if (expiresBefore) query = query.not("plan_id", "is", null).lte("plan_expires_at", expiresBefore);
  if (expiresAfter) query = query.not("plan_id", "is", null).gte("plan_expires_at", expiresAfter);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as AdminUserRow[], total: count ?? 0 };
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

async function getUserTransactions(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, coins, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ blocked_at: blocked ? new Date().toISOString() : null })
    .eq("id", userId);
  if (error) throw error;
}

async function adjustCoins(userId: string, delta: number, reason: string) {
  const { data, error } = await supabase.rpc("admin_adjust_coin_balance", {
    user_uuid: userId,
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
  setBlocked,
  adjustCoins,
};
