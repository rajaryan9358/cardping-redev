import "server-only";
import OpenAI from "openai";
import { appEnvFiles } from "./appEnvFiles";

// Duplicated from server/src/integrations/openai/{client,vision}.ts, on
// purpose — see the plan's architecture note: admin/ never imports from
// server/ or shares its process, so a compromised internet-facing server/
// can't inherit admin capabilities. The OpenAI key itself isn't duplicated
// into admin/.env though; it's read out of server/.env at call time (same
// mechanism the Env Variables screen already uses), so there's exactly one
// place that secret lives on disk.
const EXTRACTION_PROMPT = `You are an expert at extracting contact information from business cards.

Return ONLY a valid JSON object that exactly follows this schema.
Do not add explanations, comments, markdown formatting, or code fences.
Do not wrap the JSON in quotes or text.
Output must be raw JSON only.

Schema:
{
  "person_name": "",
  "company_name": "",
  "job_title": "",
  "primary_email": "",
  "secondary_email": "",
  "primary_phone": "",
  "secondary_phone": "",
  "mobile_phone": "",
  "fax": "",
  "website": "",
  "address": {
    "street": "",
    "city": "",
    "state": "",
    "postal_code": "",
    "country": ""
  },
  "social_media": {
    "linkedin": "",
    "twitter": "",
    "facebook": ""
  },
  "confidence": 0.85,
  "notes": ""
}

Rules:
- Extract ONLY what is visible on the card (no guessing).
- Use exact spelling, formatting, and punctuation from the card.
- Return missing fields as "" (empty string).
- Phone numbers must be exactly as shown (with +, (), -, etc.).
- Confidence must be between 0.5 and 1.0 based on clarity.`;

function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim().replace(/```json|```/g, "").trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return JSON.parse(text) as T;
}

export async function reExtractCardFromImageUrl(imageUrl: string): Promise<Record<string, unknown>> {
  const [apiKey, model] = await Promise.all([
    appEnvFiles.readEnvValue("server", "OPENAI_API_KEY"),
    appEnvFiles.readEnvValue("server", "OPENAI_VISION_MODEL"),
  ]);
  if (!apiKey) throw new Error("OPENAI_API_KEY not found in server/.env");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download card image: ${imageResponse.status}`);
  const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64 = buffer.toString("base64");

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: model || "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseJsonResponse<Record<string, unknown>>(raw);
}
