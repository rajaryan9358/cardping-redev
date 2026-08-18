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
  company_name: string | null;
  uploaded_by: string | null;
  extraction_confidence: number | null;
  storage_path: string | null;
  image_public_url: string | null;
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
}

export interface ListCardsParams {
  maxConfidence: number;
  sort?: string;
  page: number;
  pageSize: number;
}

async function listLowConfidenceCards({
  maxConfidence,
  sort,
  page,
  pageSize,
}: ListCardsParams): Promise<Paginated<AdminCardRow>> {
  const from = (page - 1) * pageSize;
  const parsedSort = parseSort(sort);
  const orderField = parsedSort && SORTABLE_FIELDS.has(parsedSort.field) ? parsedSort.field : "created_at";
  const orderAscending = parsedSort && SORTABLE_FIELDS.has(parsedSort.field) ? parsedSort.ascending : false;

  const { data, error, count } = await supabase
    .from("visiting_cards")
    .select(
      "id, user_id, event_id, full_name, company_name, uploaded_by, extraction_confidence, storage_path, image_public_url, created_at, user:users!visiting_cards_user_id_fkey(full_name, email)",
      { count: "exact" },
    )
    .not("extraction_confidence", "is", null)
    .lte("extraction_confidence", maxConfidence)
    .order(orderField, { ascending: orderAscending })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
  }));
  return { rows: rows as unknown as AdminCardRow[], total: count ?? 0 };
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

export const adminCardsRepo = {
  listLowConfidenceCards,
  getCardById,
  updateExtractedFields,
};
