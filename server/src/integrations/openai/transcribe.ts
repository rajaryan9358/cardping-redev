import { toFile } from "openai/uploads";
import { env } from "../../config/env";
import { openai } from "./client";

export interface TranscriptionResult {
  text: string;
  audioSeconds: number | null;
}

/** `verbose_json` (Whisper-only — gpt-4o-transcribe/-mini don't support
 * it) buys a real `duration` in the response instead of guessing one from
 * buffer size, so the usage log's cost-per-minute comparison is accurate. */
export async function transcribeAudio(buffer: Buffer, filename = "voice-note.ogg"): Promise<TranscriptionResult> {
  const file = await toFile(buffer, filename);
  const response = await openai.audio.transcriptions.create({
    model: env.OPENAI_TRANSCRIBE_MODEL,
    file,
    response_format: "verbose_json",
  });
  return { text: response.text, audioSeconds: response.duration ?? null };
}
