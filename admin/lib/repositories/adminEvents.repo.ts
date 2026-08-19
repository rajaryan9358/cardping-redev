import "server-only";
import { supabase } from "../supabase";
import { Paginated } from "./adminUsers.repo";
import { parseSort } from "../sort";

export interface AdminEventRow {
  id: string;
  name: string;
  created_at: string;
  user_id: string | null;
  owner: { full_name: string | null; email: string | null } | null;
  cardCount: number;
}

export interface ListEventsParams {
  ownerSearch?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

const SORTABLE_FIELDS = new Set(["created_at", "cardCount"]);

/** Prefers the linked dashboard account's real email/name over the
 * channel identity's own (almost always blank) columns — same bug/fix
 * shape as adminUsersRepo's account-aware detail page. Batched: one
 * channel_links lookup + one accounts lookup for every distinct owner in
 * the page, not per-row. */
async function resolveOwners(
  userIds: string[],
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const result = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length === 0) return result;

  const { data: links, error: linkErr } = await supabase
    .from("channel_links")
    .select("users_id, account_id")
    .in("users_id", userIds);
  if (linkErr) throw linkErr;
  if (!links || links.length === 0) return result;

  const accountIds = [...new Set(links.map((l) => l.account_id))];
  const { data: accounts, error: accErr } = await supabase.from("accounts").select("id, full_name, email").in("id", accountIds);
  if (accErr) throw accErr;

  const accountsById = new Map((accounts ?? []).map((a) => [a.id, a]));
  for (const link of links) {
    const account = accountsById.get(link.account_id);
    if (account) result.set(link.users_id, { full_name: account.full_name, email: account.email });
  }
  return result;
}

/** Card count is a computed aggregate, not a DB column (see the two-query
 * approach below), so sorting by it means fetching every matching event,
 * computing counts, sorting in memory, then slicing the page — a
 * documented trade-off, fine at this app's scale. Same for the owner
 * filter, since matching against a joined table's columns through
 * PostgREST's embed-filter syntax is fragile; filtering in memory after
 * the join is simpler and just as correct here. */
async function listEvents({ ownerSearch, sort, page, pageSize }: ListEventsParams): Promise<Paginated<AdminEventRow>> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, created_at, user_id, owner:users!events_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rawEvents = (data ?? []).map((event) => ({
    ...event,
    owner: Array.isArray(event.owner) ? event.owner[0] ?? null : event.owner,
  }));
  const resolvedOwners = await resolveOwners(rawEvents.map((e) => e.user_id).filter((id): id is string => !!id));
  let events = rawEvents.map((event) => ({
    ...event,
    owner: (event.user_id && resolvedOwners.get(event.user_id)) || event.owner,
  }));

  const term = ownerSearch?.trim().toLowerCase();
  if (term) {
    events = events.filter(
      (event) =>
        event.owner?.full_name?.toLowerCase().includes(term) ||
        event.owner?.email?.toLowerCase().includes(term),
    );
  }

  const eventIds = events.map((event) => event.id);
  const counts = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: cards, error: cardsError } = await supabase
      .from("visiting_cards")
      .select("event_id")
      .in("event_id", eventIds);
    if (cardsError) throw cardsError;
    for (const card of cards ?? []) {
      if (!card.event_id) continue;
      counts.set(card.event_id, (counts.get(card.event_id) ?? 0) + 1);
    }
  }

  let rows = events.map((event) => ({ ...event, cardCount: counts.get(event.id) ?? 0 })) as AdminEventRow[];

  const parsedSort = parseSort(sort);
  if (parsedSort && SORTABLE_FIELDS.has(parsedSort.field)) {
    const { field, ascending } = parsedSort;
    rows = [...rows].sort((a, b) => {
      const diff = field === "cardCount" ? a.cardCount - b.cardCount : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return ascending ? diff : -diff;
    });
  }

  const total = rows.length;
  const from = (page - 1) * pageSize;
  return { rows: rows.slice(from, from + pageSize), total };
}

async function getEventDetail(eventId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, created_at, user_id, owner:users!events_user_id_fkey(full_name, email)")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const rawOwner = Array.isArray(data.owner) ? data.owner[0] ?? null : data.owner;
  const resolvedOwners = await resolveOwners(data.user_id ? [data.user_id] : []);
  const owner = (data.user_id && resolvedOwners.get(data.user_id)) || rawOwner;
  return { ...data, owner };
}

async function getEventCards(eventId: string) {
  const { data, error } = await supabase
    .from("visiting_cards")
    .select("id, full_name, company_name, uploaded_by, extraction_confidence, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const adminEventsRepo = {
  listEvents,
  getEventDetail,
  getEventCards,
};
