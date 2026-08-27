import { env } from "../../config/env";
import { aiUsageLogRepo } from "../../db/repositories/aiUsageLog.repo";
import { transcribeAudio as transcribeWithOpenAi } from "../openai/transcribe";
import { transcribeAudio as transcribeWithGoogle } from "../google/speechToText";

const GOOGLE_STT_MODEL = "google-speech-v1";

// OpenAI picks a decoder mainly off the filename extension — a browser
// recording (mimeType like "audio/webm;codecs=opus") needs a matching
// filename, or Whisper may misdetect the container. Bot-sourced audio
// (undefined mimeType) keeps transcribeAudio's own "voice-note.ogg"
// default, which is accurate for WhatsApp/Telegram voice notes.
function filenameForMimeType(mimeType?: string): string | undefined {
  if (!mimeType) return undefined;
  if (mimeType.includes("webm")) return "voice-note.webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "voice-note.m4a";
  if (mimeType.includes("wav")) return "voice-note.wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "voice-note.mp3";
  return "voice-note.ogg";
}

/** The one place either bot should call for voice-note transcription —
 * picks OpenAI Whisper or Google Speech-to-Text per TRANSCRIPTION_PROVIDER
 * and logs the call to ai_provider_usage_log itself (unlike vision, the
 * card already exists by the time a voice note is attached, so there's no
 * ordering problem logging directly here). Re-throws on failure after
 * logging it, same as before this wrapper existed. */
export async function transcribeWithLogging(buffer: Buffer, cardId: string, mimeType?: string): Promise<string> {
  const provider = env.TRANSCRIPTION_PROVIDER;
  const model = provider === "google" ? GOOGLE_STT_MODEL : env.OPENAI_TRANSCRIBE_MODEL;
  const started = Date.now();

  try {
    let text: string;
    let audioSeconds: number | null;
    let confidence: number | null = null;
    if (provider === "google") {
      // Still assumes OGG_OPUS regardless of mimeType — see the warning in
      // google/speechToText.ts. Not fixed here since TRANSCRIPTION_PROVIDER
      // defaults to openai and this path is already flagged unverified.
      const result = await transcribeWithGoogle(buffer);
      text = result.text;
      audioSeconds = result.audioSeconds;
      confidence = result.confidence;
    } else {
      const result = await transcribeWithOpenAi(buffer, filenameForMimeType(mimeType));
      text = result.text;
      audioSeconds = result.audioSeconds;
    }
    await aiUsageLogRepo.record({
      task: "transcription",
      provider,
      model,
      cardId,
      audioSeconds,
      confidence,
      latencyMs: Date.now() - started,
      success: true,
    });
    return text;
  } catch (err) {
    await aiUsageLogRepo.record({
      task: "transcription",
      provider,
      model,
      cardId,
      latencyMs: Date.now() - started,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }
}
