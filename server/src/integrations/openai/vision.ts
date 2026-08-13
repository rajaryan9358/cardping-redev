import { env } from "../../config/env";
import { ExtractedCard } from "../../types/domain";
import { openai, parseJsonResponse } from "./client";

// Ported verbatim from the WhatsApp bot's "Analyze image" node — this is
// the extraction prompt/schema both bots now share (the Telegram bot used
// to use Google Vision OCR + a separate LangChain agent; standardising on
// one GPT-4o vision call, per the handoff doc's own recommendation).
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

export async function extractCardFromImage(imageBuffer: Buffer, mimeType: string): Promise<ExtractedCard> {
  const base64 = imageBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: env.OPENAI_VISION_MODEL,
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
  return parseJsonResponse<ExtractedCard>(raw);
}
