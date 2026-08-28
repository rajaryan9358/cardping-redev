import { env } from "../../config/env";
import { ExtractedCard } from "../../types/domain";
import { DUAL_SIDE_PROMPT, EXTRACTION_PROMPT, qrContextBlock } from "../ai/visionPrompt";
import { openai, parseJsonResponse } from "./client";

export interface VisionExtractionResult {
  extracted: ExtractedCard;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** `back` is optional — when present (scan_both_sides is on and a back
 * photo was captured), both images go into the same call so the model
 * merges them itself rather than the two extractions being combined after
 * the fact. Exported for the ai/vision.ts provider dispatcher — bots
 * should import extractCardFromImages from there, not this file directly,
 * so the VISION_PROVIDER switch actually applies. */
export async function extractCardFromImages(
  front: Buffer,
  frontMimeType: string,
  back?: Buffer,
  backMimeType?: string,
  decodedQrContent?: string | null,
): Promise<VisionExtractionResult> {
  const imageBlocks: Array<{ type: "image_url"; image_url: { url: string } }> = [
    { type: "image_url", image_url: { url: `data:${frontMimeType};base64,${front.toString("base64")}` } },
  ];
  if (back && backMimeType) {
    imageBlocks.push({
      type: "image_url",
      image_url: { url: `data:${backMimeType};base64,${back.toString("base64")}` },
    });
  }

  const response = await openai.chat.completions.create({
    model: env.OPENAI_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT + (back ? DUAL_SIDE_PROMPT : "") + qrContextBlock(decodedQrContent) },
          ...imageBlocks,
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return {
    extracted: parseJsonResponse<ExtractedCard>(raw),
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
}
