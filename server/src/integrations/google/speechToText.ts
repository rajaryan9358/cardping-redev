import { env } from "../../config/env";
import { TranscriptionResult } from "../openai/transcribe";

interface GoogleWord {
  endTime?: string; // e.g. "12.400s"
}

interface GoogleSpeechResponse {
  results?: { alternatives?: { transcript?: string; confidence?: number; words?: GoogleWord[] }[] }[];
}

function parseSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/s$/, ""));
  return Number.isFinite(n) ? n : null;
}

export interface GoogleTranscriptionResult extends TranscriptionResult {
  confidence: number | null;
}

/** Google Cloud Speech-to-Text v1 REST API, plain fetch (no
 * @google-cloud/speech SDK — that needs service-account JSON credentials;
 * the simple API-key auth this app uses everywhere else works fine for
 * the synchronous `recognize` endpoint). WhatsApp/Telegram voice notes are
 * OGG/Opus — encoding/sampleRateHertz below assume that; verify against a
 * real voice note before relying on this in production, adjusting if
 * Telegram's actual sample rate differs. Word-level time offsets are
 * requested purely to derive audioSeconds (the API has no duration field
 * of its own), matching openai/transcribe.ts's verbose_json duration so
 * both providers log a comparable cost basis. */
export async function transcribeAudio(buffer: Buffer): Promise<GoogleTranscriptionResult> {
  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${env.GOOGLE_SPEECH_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "OGG_OPUS",
        sampleRateHertz: 16000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
      },
      audio: { content: buffer.toString("base64") },
    }),
  });
  if (!res.ok) {
    throw new Error(`Google Speech-to-Text request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as GoogleSpeechResponse;
  // Longer audio can come back as multiple sequential results (each its
  // own recognized segment) — concatenate all of them, not just the
  // first, and average their confidence.
  const alternatives = (data.results ?? []).map((r) => r.alternatives?.[0]).filter((a): a is NonNullable<typeof a> => !!a);
  const text = alternatives.map((a) => a.transcript ?? "").join(" ").trim();
  const confidences = alternatives.map((a) => a.confidence).filter((c): c is number => typeof c === "number");
  const confidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

  const words = alternatives.flatMap((a) => a.words ?? []);
  const lastEndTime = words.length > 0 ? parseSeconds(words[words.length - 1].endTime) : null;

  return { text, confidence, audioSeconds: lastEndTime };
}
