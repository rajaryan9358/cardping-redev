import { visitingCardsRepo } from "../db/repositories/visitingCards.repo";
import { transcribeAudio } from "../integrations/openai/transcribe";
import { supabaseStorage } from "../integrations/storage/supabaseStorage";
import { VisitingCard } from "../types/domain";

/** Transcribes a voice note and attaches it to the card it was recorded
 * as a reply to (matched earlier via visiting_cards.message_id). */
export async function attachVoiceNoteToCard(
  userId: string,
  card: VisitingCard,
  audioBuffer: Buffer,
): Promise<string> {
  const [transcript, upload] = await Promise.all([
    transcribeAudio(audioBuffer),
    supabaseStorage.uploadVoiceNote(userId, card.id, audioBuffer),
  ]);

  await visitingCardsRepo.setVoiceNote(card.id, transcript, upload.path, upload.publicUrl);
  return transcript;
}
