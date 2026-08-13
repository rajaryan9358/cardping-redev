import { toFile } from "openai/uploads";
import { env } from "../../config/env";
import { openai } from "./client";

export async function transcribeAudio(buffer: Buffer, filename = "voice-note.ogg"): Promise<string> {
  const file = await toFile(buffer, filename);
  const response = await openai.audio.transcriptions.create({
    model: env.OPENAI_TRANSCRIBE_MODEL,
    file,
  });
  return response.text;
}
