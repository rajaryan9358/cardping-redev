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
  status: "active" | "inactive";
  location: string | null;
  event_date: string | null;
  thumbnail_public_url: string | null;
}

const EVENT_COLUMNS = "id, name, created_at, user_id, status, location, event_date, thumbnail_public_url, owner:users!events_user_id_fkey(full_name, email)";

export interface ListEventsParams {
  // Matches an event's own name as well as its owner's name/email —
  // "ownerSearch" was renamed once it stopped being owner-only.
  search?: string;
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
export type ListEventsFilterParams = Omit<ListEventsParams, "page" | "pageSize">;

/** Fetches + filters + sorts every matching row, unpaginated — shared by
 * listEvents (which slices a page off the end) and listEventsForExport
 * (which returns everything, matching the current filters exactly). */
async function buildFilteredEventRows({ search, sort }: ListEventsFilterParams): Promise<AdminEventRow[]> {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).order("created_at", { ascending: false });
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

  const term = search?.trim().toLowerCase();
  if (term) {
    events = events.filter(
      (event) =>
        event.name.toLowerCase().includes(term) ||
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

  return rows;
}

async function listEvents(params: ListEventsParams): Promise<Paginated<AdminEventRow>> {
  const rows = await buildFilteredEventRows(params);
  const from = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(from, from + params.pageSize), total: rows.length };
}

async function listEventsForExport(params: ListEventsFilterParams): Promise<AdminEventRow[]> {
  return buildFilteredEventRows(params);
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

async function updateEvent(
  eventId: string,
  patch: { name?: string; location?: string | null; event_date?: string | null; status?: "active" | "inactive" },
): Promise<void> {
  const { error } = await supabase.from("events").update(patch).eq("id", eventId);
  if (error) throw error;
}

function thumbnailTimestampSlug(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
}

/** Same bucket/path convention as server/src/integrations/storage/
 * supabaseStorage.ts#uploadEventThumbnail — admin talks to Supabase
 * Storage directly with its own service-role client rather than proxying
 * through server/'s session-authenticated dashboard endpoint, consistent
 * with every other admin repo function. */
async function uploadThumbnail(eventId: string, buffer: Buffer, contentType: string): Promise<void> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${eventId}/${thumbnailTimestampSlug()}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from("event-thumbnails").upload(path, buffer, { contentType, upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from("event-thumbnails").getPublicUrl(path);
  const { error } = await supabase
    .from("events")
    .update({ thumbnail_path: path, thumbnail_public_url: data.publicUrl })
    .eq("id", eventId);
  if (error) throw error;
}

/** `visiting_cards.event_id` is ON DELETE SET NULL, so deleting an event
 * by default just orphans its cards (they survive, event_id -> null) —
 * `alsoDeleteCards: true` is the real branch the UI checkbox controls,
 * explicitly deleting them first instead of relying on that default. */
async function deleteEvent(eventId: string, alsoDeleteCards: boolean): Promise<void> {
  if (alsoDeleteCards) {
    const { error: cardsErr } = await supabase.from("visiting_cards").delete().eq("event_id", eventId);
    if (cardsErr) throw cardsErr;
  }
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

async function bulkDeleteEvents(eventIds: string[], alsoDeleteCards: boolean): Promise<void> {
  if (eventIds.length === 0) return;
  if (alsoDeleteCards) {
    const { error: cardsErr } = await supabase.from("visiting_cards").delete().in("event_id", eventIds);
    if (cardsErr) throw cardsErr;
  }
  const { error } = await supabase.from("events").delete().in("id", eventIds);
  if (error) throw error;
}

export const adminEventsRepo = {
  listEvents,
  listEventsForExport,
  getEventDetail,
  getEventCards,
  updateEvent,
  uploadThumbnail,
  deleteEvent,
  bulkDeleteEvents,
};
