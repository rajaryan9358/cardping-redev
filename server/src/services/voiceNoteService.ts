import { cardVoiceNotesRepo, CardVoiceNoteRow } from "../db/repositories/cardVoiceNotes.repo";
import { cardInteractionsRepo } from "../db/repositories/cardInteractions.repo";
import { transcribeWithLogging } from "../integrations/ai/transcribe";
import { supabaseStorage } from "../integrations/storage/supabaseStorage";
import { VisitingCard } from "../types/domain";

/** Transcribes a voice note and adds it to the card's list — a card can
 * have any number of these (one per reply, from any channel identity or
 * the dashboard's own recorder), each kept as its own row rather than
 * overwriting a single "latest note" column. `ownerId` is only used to
 * namespace the storage path (a channel identity id for a bot-received
 * note, the account id for a dashboard-recorded one) — it isn't a foreign
 * key anywhere. */
export async function attachVoiceNoteToCard(
  ownerId: string,
  card: VisitingCard,
  audioBuffer: Buffer,
  mimeType?: string,
): Promise<CardVoiceNoteRow> {
  const [transcript, upload] = await Promise.all([
    transcribeWithLogging(audioBuffer, card.id, mimeType),
    supabaseStorage.uploadVoiceNote(ownerId, card.id, audioBuffer, mimeType),
  ]);

  const note = await cardVoiceNotesRepo.create(card.id, upload.path, upload.publicUrl, transcript);
  await cardInteractionsRepo.create(card.id, "voice_note_added");
  return note;
}
