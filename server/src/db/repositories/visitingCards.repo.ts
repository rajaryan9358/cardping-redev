import { supabase } from "../client";
import { Channel, ExtractedCard, VisitingCard } from "../../types/domain";

export interface CreateVisitingCardInput {
  userId: string;
  eventId: string | null;
  uploadedBy: Channel;
  extracted: ExtractedCard;
}

function flattenAddress(address: ExtractedCard["address"]): string {
  return [address.street, address.city, address.state, address.postal_code, address.country]
    .filter((part) => part && part.trim().length > 0)
    .join(", ");
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
      address: flattenAddress(extracted.address) || null,
      phone1: extracted.primary_phone || null,
      phone2: extracted.secondary_phone || null,
      business_email: extracted.primary_email || null,
      personal_email: extracted.secondary_email || null,
      website: extracted.website || null,
      linkedin: extracted.social_media.linkedin || null,
      twitter: extracted.social_media.twitter || null,
      facebook: extracted.social_media.facebook || null,
      uploaded_by: input.uploadedBy,
      extraction_confidence: extracted.confidence,
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

async function setVoiceNote(
  cardId: string,
  transcript: string,
  voiceNotePath: string,
  voiceNotePublicUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("visiting_cards")
    .update({
      transcribed_note: transcript,
      voice_note_path: voiceNotePath,
      voice_note_public_url: voiceNotePublicUrl,
    })
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
 * whose extraction message it replied to — same trick the n8n flow used
 * with `context.id` / `visiting_cards.message_id`. */
async function findByMessageId(messageId: string): Promise<VisitingCard | null> {
  const { data, error } = await supabase
    .from("visiting_cards")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data as VisitingCard | null;
}

export const visitingCardsRepo = {
  create,
  setMessageId,
  setImageStorage,
  setVoiceNote,
  findById,
  findByMessageId,
};
