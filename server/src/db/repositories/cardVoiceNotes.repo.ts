import { supabase } from "../client";

export interface CardVoiceNoteRow {
  id: string;
  card_id: string;
  storage_path: string;
  public_url: string;
  transcript: string | null;
  created_at: string;
}

async function create(cardId: string, storagePath: string, publicUrl: string, transcript: string): Promise<CardVoiceNoteRow> {
  const { data, error } = await supabase
    .from("card_voice_notes")
    .insert({ card_id: cardId, storage_path: storagePath, public_url: publicUrl, transcript })
    .select("*")
    .single();
  if (error) throw error;
  return data as CardVoiceNoteRow;
}

async function listForCard(cardId: string): Promise<CardVoiceNoteRow[]> {
  const { data, error } = await supabase
    .from("card_voice_notes")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CardVoiceNoteRow[];
}

export const cardVoiceNotesRepo = { create, listForCard };
