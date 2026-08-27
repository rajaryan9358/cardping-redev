import { supabase } from "../client";

export type InteractionType = "created" | "voice_note_added" | "edited" | "archived" | "unarchived" | "event_changed";

export interface CardInteractionRow {
  id: string;
  card_id: string;
  type: InteractionType;
  detail: Record<string, unknown> | null;
  created_at: string;
}

async function create(cardId: string, type: InteractionType, detail?: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("card_interactions").insert({ card_id: cardId, type, detail: detail ?? null });
  if (error) throw error;
}

async function listForCard(cardId: string): Promise<CardInteractionRow[]> {
  const { data, error } = await supabase
    .from("card_interactions")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CardInteractionRow[];
}

export const cardInteractionsRepo = { create, listForCard };
