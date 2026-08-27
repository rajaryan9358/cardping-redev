import { supabase } from "../client";
import { Channel, ExtractedCard, VisitingCard } from "../../types/domain";
import { cardMessageRefsRepo } from "./cardMessageRefs.repo";

export interface CreateVisitingCardInput {
  userId: string;
  eventId: string | null;
  uploadedBy: Channel;
  extracted: ExtractedCard;
  provider: string;
  model: string;
}

/** Every repeatable extracted field (phones/emails/addresses) is an array
 * — this is where it becomes the single newline-joined value each DB
 * column actually stores. Dedupes so the same value appearing on both
 * sides of a dual-side scan doesn't produce a repeated line. */
function joinLines(values: string[]): string | null {
  const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)));
  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

async function create(input: CreateVisitingCardInput): Promise<VisitingCard> {
  const { extracted } = input;
  const { data, error } = await supabase
    .from("visiting_cards")
    .insert({
      user_id: input.userId,
      event_id: input.eventId,
      full_name: extracted.person_name || null,
      position: extracted.job_title || null,
      company_name: extracted.company_name || null,
      address: joinLines(extracted.addresses),
      // phone2 is intentionally left unset here — every number found now
      // collects into phone1 as one newline-separated value (see
      // joinLines above). The column stays on old rows that already used
      // it as a genuine second field; new scans just don't write it.
      phone1: joinLines(extracted.phones),
      business_email: joinLines(extracted.business_emails),
      personal_email: joinLines(extracted.personal_emails),
      website: joinLines(extracted.websites),
      linkedin: extracted.social_media.linkedin || null,
      twitter: extracted.social_media.twitter || null,
      facebook: extracted.social_media.facebook || null,
      qr_code_content: extracted.qr_code_content || null,
      additional_info: extracted.additional_info || null,
      uploaded_by: input.uploadedBy,
      extraction_confidence: extracted.confidence,
      extraction_provider: input.provider,
      extraction_model: input.model,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as VisitingCard;
}

async function setMessageId(cardId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from("visiting_cards")
    .update({ message_id: messageId })
    .eq("id", cardId);
  if (error) throw error;
}

async function setImageStorage(
  cardId: string,
  storagePath: string,
  publicUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("visiting_cards")
    .update({ storage_path: storagePath, image_public_url: publicUrl, image_url: storagePath })
    .eq("id", cardId);
  if (error) throw error;
}

async function setBackImageStorage(
  cardId: string,
  storagePath: string,
  publicUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("visiting_cards")
    .update({ back_storage_path: storagePath, back_image_public_url: publicUrl })
    .eq("id", cardId);
  if (error) throw error;
}

async function findById(cardId: string): Promise<VisitingCard | null> {
  const { data, error } = await supabase
    .from("visiting_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw error;
  return data as VisitingCard | null;
}

/** Used to match an inbound voice note (sent as a reply) back to the card
 * whose extraction message it replied to. Checks card_message_refs first
 * (every message a scan's result touched — front/back photo, voice-note
 * hint, summary), falling back to the legacy single message_id column for
 * cards scanned before that table existed. */
async function findByMessageId(messageId: string): Promise<VisitingCard | null> {
  const refCardId = await cardMessageRefsRepo.findCardIdByMessageId(messageId);
  if (refCardId) {
    const { data, error } = await supabase.from("visiting_cards").select("*").eq("id", refCardId).maybeSingle();
    if (error) throw error;
    if (data) return data as VisitingCard;
  }

  const { data, error } = await supabase
    .from("visiting_cards")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data as VisitingCard | null;
}

// ── dashboard/ account-scoped access ────────────────────────────────────
// Every function below takes `usersIds` (the account's linked channel
// identities, resolved via channelLinksRepo.listByAccountId) rather than
// a single userId — this is the mechanism behind "scan on WhatsApp and
// Telegram, see both in one Directory." Never trust a bare card id
// without also filtering by this set.

export interface CardFilters {
  query?: string;
  eventId?: string;
  tag?: string;
  archived?: boolean;
}

export interface DashboardCard extends VisitingCard {
  event: { id: string; name: string } | null;
}

const DASHBOARD_CARD_SELECT = "*, event:events(id, name)";

function applyFilters(query: any, usersIds: string[], filters: CardFilters) {
  query = query.in("user_id", usersIds);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.archived !== undefined) query = query.eq("archived", filters.archived);
  if (filters.query) {
    const q = `%${filters.query}%`;
    query = query.or(`full_name.ilike.${q},company_name.ilike.${q},"position".ilike.${q}`);
  }
  return query;
}

async function listForAccount(
  usersIds: string[],
  filters: CardFilters,
  page: number,
  pageSize: number,
): Promise<{ cards: DashboardCard[]; total: number }> {
  if (usersIds.length === 0) return { cards: [], total: 0 };

  let query = supabase.from("visiting_cards").select(DASHBOARD_CARD_SELECT, { count: "exact" });
  query = applyFilters(query, usersIds, filters);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { cards: (data ?? []) as unknown as DashboardCard[], total: count ?? 0 };
}

async function getRecentForAccount(usersIds: string[], limit: number): Promise<DashboardCard[]> {
  if (usersIds.length === 0) return [];
  const { data, error } = await supabase
    .from("visiting_cards")
    .select(DASHBOARD_CARD_SELECT)
    .in("user_id", usersIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as DashboardCard[];
}

async function findByIdForAccount(cardId: string, usersIds: string[]): Promise<DashboardCard | null> {
  if (usersIds.length === 0) return null;
  const { data, error } = await supabase
    .from("visiting_cards")
    .select(DASHBOARD_CARD_SELECT)
    .eq("id", cardId)
    .in("user_id", usersIds)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DashboardCard | null;
}

export interface CardUpdateInput {
  full_name?: string | null;
  position?: string | null;
  company_name?: string | null;
  business_email?: string | null;
  personal_email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  website?: string | null;
  address?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  qr_code_content?: string | null;
  additional_info?: string | null;
  tags?: string[];
  archived?: boolean;
  event_id?: string | null;
}

async function updateForAccount(cardId: string, usersIds: string[], patch: CardUpdateInput): Promise<DashboardCard | null> {
  if (usersIds.length === 0) return null;
  const { data, error } = await supabase
    .from("visiting_cards")
    .update(patch)
    .eq("id", cardId)
    .in("user_id", usersIds)
    .select(DASHBOARD_CARD_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DashboardCard | null;
}

async function deleteForAccount(cardId: string, usersIds: string[]): Promise<void> {
  if (usersIds.length === 0) return;
  const { error } = await supabase.from("visiting_cards").delete().eq("id", cardId).in("user_id", usersIds);
  if (error) throw error;
}

async function bulkUpdateForAccount(ids: string[], usersIds: string[], patch: CardUpdateInput): Promise<void> {
  if (usersIds.length === 0 || ids.length === 0) return;
  const { error } = await supabase.from("visiting_cards").update(patch).in("id", ids).in("user_id", usersIds);
  if (error) throw error;
}

/** Adds tags without clobbering each card's existing ones — bulk "add
 * tags" is additive, unlike bulkUpdateForAccount's plain overwrite (used
 * for single-card edits, where the client sends the full desired list). */
async function bulkAddTagsForAccount(ids: string[], usersIds: string[], tagsToAdd: string[]): Promise<void> {
  if (usersIds.length === 0 || ids.length === 0 || tagsToAdd.length === 0) return;
  const existing = await supabase.from("visiting_cards").select("id, tags").in("id", ids).in("user_id", usersIds);
  if (existing.error) throw existing.error;
  await Promise.all(
    (existing.data ?? []).map((row: any) => {
      const merged = Array.from(new Set([...(row.tags ?? []), ...tagsToAdd]));
      return supabase.from("visiting_cards").update({ tags: merged }).eq("id", row.id);
    }),
  );
}

async function bulkDeleteForAccount(ids: string[], usersIds: string[]): Promise<void> {
  if (usersIds.length === 0 || ids.length === 0) return;
  const { error } = await supabase.from("visiting_cards").delete().in("id", ids).in("user_id", usersIds);
  if (error) throw error;
}

async function countScansSince(usersIds: string[], sinceIso: string, untilIso?: string): Promise<number> {
  if (usersIds.length === 0) return 0;
  let query = supabase
    .from("visiting_cards")
    .select("id", { count: "exact", head: true })
    .in("user_id", usersIds)
    .gte("created_at", sinceIso);
  if (untilIso) query = query.lt("created_at", untilIso);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export const visitingCardsRepo = {
  create,
  setMessageId,
  setImageStorage,
  setBackImageStorage,
  findById,
  findByMessageId,
  listForAccount,
  getRecentForAccount,
  findByIdForAccount,
  updateForAccount,
  deleteForAccount,
  bulkUpdateForAccount,
  bulkAddTagsForAccount,
  bulkDeleteForAccount,
  countScansSince,
};
