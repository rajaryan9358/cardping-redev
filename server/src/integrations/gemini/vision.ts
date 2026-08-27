import { env } from "../../config/env";
import { ExtractedCard } from "../../types/domain";
import { parseJsonResponse } from "../openai/client";
import { DUAL_SIDE_PROMPT, EXTRACTION_PROMPT } from "../ai/visionPrompt";
import { VisionExtractionResult } from "../openai/vision";

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Same prompt/schema as openai/vision.ts (see visionPrompt.ts), same
 * return shape — swapped in by ai/vision.ts when VISION_PROVIDER=gemini.
 * Plain REST call (no @google/generative-ai SDK dependency), matching
 * this codebase's existing lightweight-fetch integration style. */
export async function extractCardFromImages(
  front: Buffer,
  frontMimeType: string,
  back?: Buffer,
  backMimeType?: string,
): Promise<VisionExtractionResult> {
  const parts: GeminiPart[] = [
    { text: EXTRACTION_PROMPT + (back ? DUAL_SIDE_PROMPT : "") },
    { inline_data: { mime_type: frontMimeType, data: front.toString("base64") } },
  ];
  if (back && backMimeType) {
    parts.push({ inline_data: { mime_type: backMimeType, data: back.toString("base64") } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_VISION_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini vision request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as GeminiResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  return {
    extracted: parseJsonResponse<ExtractedCard>(raw),
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}
