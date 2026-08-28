import { env } from "../../config/env";
import { ExtractedCard } from "../../types/domain";
import { extractCardFromImages as extractWithOpenAi } from "../openai/vision";
import { extractCardFromImages as extractWithGemini } from "../gemini/vision";

export interface VisionCallMeta {
  provider: "openai" | "gemini";
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  success: boolean;
  error: string | null;
}

/** The one place either bot should call for card extraction — picks
 * OpenAI or Gemini per VISION_PROVIDER and always returns timing/usage
 * metadata alongside the result, for the caller to hand to
 * aiUsageLogRepo once a card_id exists to attach it to (extraction runs
 * before the card row is created, so this itself can't log — see
 * cardService.ts). Re-throws on failure after capturing meta.error, same
 * as before this wrapper existed — a failed scan should still fail loudly,
 * not silently no-op. */
export async function extractCardWithMeta(
  front: Buffer,
  frontMimeType: string,
  back?: Buffer,
  backMimeType?: string,
  decodedQrContent?: string | null,
): Promise<{ extracted: ExtractedCard; meta: VisionCallMeta }> {
  const provider = env.VISION_PROVIDER;
  const model = provider === "gemini" ? env.GEMINI_VISION_MODEL : env.OPENAI_VISION_MODEL;
  const impl = provider === "gemini" ? extractWithGemini : extractWithOpenAi;
  const started = Date.now();

  try {
    const { extracted, inputTokens, outputTokens } = await impl(front, frontMimeType, back, backMimeType, decodedQrContent);
    return {
      extracted,
      meta: { provider, model, inputTokens, outputTokens, latencyMs: Date.now() - started, success: true, error: null },
    };
  } catch (err) {
    const meta: VisionCallMeta = {
      provider,
      model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - started,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    // Callers only ever see this via the thrown error (same behavior as
    // before this wrapper existed) — meta is lost on this path, which is
    // fine, since cardService.ts's own catch logs the usage row itself
    // when extractCardWithMeta rejects (see there).
    throw Object.assign(err instanceof Error ? err : new Error(meta.error ?? "Vision extraction failed"), { visionMeta: meta });
  }
}
