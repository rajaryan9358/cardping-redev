import { supabase } from "../client";

/** Registers a message as a valid reply-anchor for a card — see
 * scanFlowService.ts and the audio/voice handlers, which look these up so
 * a voice note replying to the front photo, the back photo, the "add a
 * voice note" hint, or the summary message all resolve to the same card. */
async function addRef(cardId: string, messageId: string): Promise<void> {
  const { error } = await supabase.from("card_message_refs").insert({ card_id: cardId, message_id: messageId });
  // A duplicate message_id (23505) is harmless — same message registered
  // twice — everything else should surface.
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

async function findCardIdByMessageId(messageId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("card_message_refs")
    .select("card_id")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data?.card_id ?? null;
}

export const cardMessageRefsRepo = { addRef, findCardIdByMessageId };
