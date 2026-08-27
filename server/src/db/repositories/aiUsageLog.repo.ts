import { supabase } from "../client";
import { childLogger } from "../../lib/logger";

const log = childLogger("ai-usage-log");

export type AiUsageTask = "vision_extraction" | "transcription";

export interface AiUsageLogEntry {
  task: AiUsageTask;
  provider: string;
  model: string;
  cardId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  audioSeconds?: number | null;
  confidence?: number | null;
  latencyMs: number;
  success: boolean;
  error?: string | null;
}

/** Developer-only comparison log — see db/2026-08-25_ai_provider_switch.sql
 * for why this table exists and why nothing reads it back through any
 * admin/dashboard route. A logging failure here must never surface to the
 * user or fail the scan/transcription it's describing, so this swallows
 * its own errors. */
async function record(entry: AiUsageLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("ai_provider_usage_log").insert({
      task: entry.task,
      provider: entry.provider,
      model: entry.model,
      card_id: entry.cardId ?? null,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      audio_seconds: entry.audioSeconds ?? null,
      confidence: entry.confidence ?? null,
      latency_ms: entry.latencyMs,
      success: entry.success,
      error: entry.error ?? null,
    });
    if (error) throw error;
  } catch (err) {
    log.error({ err, entry }, "failed to write AI provider usage log");
  }
}

export const aiUsageLogRepo = { record };
