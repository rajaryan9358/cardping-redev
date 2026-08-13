import OpenAI from "openai";
import { env } from "../../config/env";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/** Model replies are asked to be raw JSON, but models routinely wrap it in
 * ```json fences or stray quoting anyway — this undoes that before
 * JSON.parse, same defensive step the original "Format Output" Code node
 * did. */
export function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim().replace(/```json|```/g, "").trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return JSON.parse(text) as T;
}
