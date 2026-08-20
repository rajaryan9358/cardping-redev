import "server-only";
import { supabase } from "../supabase";
import { Paginated } from "./adminUsers.repo";
import { parseSort } from "../sort";

const SORTABLE_FIELDS = new Set(["created_at", "extraction_confidence"]);

export interface AdminCardRow {
  id: string;
  user_id: string;
  event_id: string | null;
  full_name: string | null;
  position: string | null;
  company_name: string | null;
  business_email: string | null;
  personal_email: string | null;
  phone1: string | null;
  phone2: string | null;
  website: string | null;
  address: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  uploaded_by: string | null;
  extraction_confidence: number | null;
  storage_path: string | null;
  image_public_url: string | null;
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
}

// The extra contact fields beyond what the table itself displays are
// selected too — the Edit modal needs them, and fetching them inline
// avoids a second round-trip when Edit is clicked (negligible payload
// cost at this page size).
const CARD_ROW_COLUMNS =
  "id, user_id, event_id, full_name, position, company_name, business_email, personal_email, phone1, phone2, website, address, linkedin, twitter, facebook, instagram, uploaded_by, extraction_confidence, storage_path, image_public_url, created_at, user:users!visiting_cards_user_id_fkey(full_name, email)";

export interface ListCardsParams {
  maxConfidence: number;
  // Both independent of confidence and of each other, and combinable with
  // it — a "view this person's cards" or "view this event's cards" link
  // from Users/Events narrows down to their cards without abandoning the
  // confidence filter already in place.
  userIds?: string[];
  eventId?: string;
  // Free-text, independent of and combinable with every filter above.
  search?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

export type ListCardsFilterParams = Omit<ListCardsParams, "page" | "pageSize">;

/** Builds the filtered (not yet ordered/paginated/counted) query — shared
 * by listLowConfidenceCards (DB-level .range() pagination) and
 * listCardsForExport (no range, matching the current filters exactly). */
function buildFilteredCardsQuery({ maxConfidence, userIds, eventId, search }: ListCardsFilterParams) {
  let query = supabase.from("visiting_cards").select(CARD_ROW_COLUMNS, { count: "exact" });

  // "All" (maxConfidence >= 1, the top segmented-control option) means
  // literally all cards, including ones scanned before extraction_confidence
  // existed (added 5 days after the bot went live, no backfill) — those
  // rows are NULL and would otherwise be silently excluded by the not-null
  // filter regardless of threshold. Every narrower percentage option keeps
  // excluding unscored cards, since "≤70% confidence" can't sensibly
  // include "confidence unknown".
  if (maxConfidence < 1) {
    query = query.not("extraction_confidence", "is", null).lte("extraction_confidence", maxConfidence);
  }
  if (userIds && userIds.length > 0) query = query.in("user_id", userIds);
  if (eventId) query = query.eq("event_id", eventId);
  const term = search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,]/g, (c) => `\\${c}`);
    query = query.or(
      [
        `full_name.ilike.%${escaped}%`,
        `company_name.ilike.%${escaped}%`,
        `business_email.ilike.%${escaped}%`,
        `personal_email.ilike.%${escaped}%`,
        `phone1.ilike.%${escaped}%`,
        `phone2.ilike.%${escaped}%`,
      ].join(","),
    );
  }

  return query;
}

async function listLowConfidenceCards({
  page,
  pageSize,
  sort,
  ...filters
}: ListCardsParams): Promise<Paginated<AdminCardRow>> {
  const from = (page - 1) * pageSize;
  const parsedSort = parseSort(sort);
  const orderField = parsedSort && SORTABLE_FIELDS.has(parsedSort.field) ? parsedSort.field : "created_at";
  const orderAscending = parsedSort && SORTABLE_FIELDS.has(parsedSort.field) ? parsedSort.ascending : false;

  const { data, error, count } = await buildFilteredCardsQuery(filters)
    .order(orderField, { ascending: orderAscending })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
  }));
  return { rows: rows as unknown as AdminCardRow[], total: count ?? 0 };
}

// Safety cap on an unpaginated export — this app has no card volume
// anywhere near this today, but an admin's filter/search could always be
// broad enough to match everything.
const EXPORT_ROW_LIMIT = 10_000;

async function listCardsForExport(filters: ListCardsFilterParams): Promise<AdminCardRow[]> {
  const { data, error } = await buildFilteredCardsQuery(filters).order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, user: Array.isArray(row.user) ? row.user[0] ?? null : row.user })) as unknown as AdminCardRow[];
}

async function getCardById(cardId: string) {
  const { data, error } = await supabase.from("visiting_cards").select("*").eq("id", cardId).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateExtractedFields(
  cardId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("visiting_cards").update(fields).eq("id", cardId);
  if (error) throw error;
}

async function deleteCard(cardId: string): Promise<void> {
  const { error } = await supabase.from("visiting_cards").delete().eq("id", cardId);
  if (error) throw error;
}

async function bulkDeleteCards(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  const { error } = await supabase.from("visiting_cards").delete().in("id", cardIds);
  if (error) throw error;
}

export const adminCardsRepo = {
  listLowConfidenceCards,
  listCardsForExport,
  getCardById,
  updateExtractedFields,
  deleteCard,
  bulkDeleteCards,
};
