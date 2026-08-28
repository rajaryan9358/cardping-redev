import "server-only";
import OpenAI from "openai";
import { appEnvFiles } from "./appEnvFiles";
import { decodeQrFromImage } from "./qrDecode";

export type ExtractionProvider = "openai" | "gemini";

// Duplicated from server/src/integrations/{openai,gemini}/vision.ts, on
// purpose — see the plan's architecture note: admin/ never imports from
// server/ or shares its process, so a compromised internet-facing server/
// can't inherit admin capabilities. The API keys themselves aren't
// duplicated into admin/.env though; they're read out of server/.env at
// call time (same mechanism the Env Variables screen already uses), so
// there's exactly one place each secret lives on disk.
// Kept in sync by hand with server/src/integrations/ai/visionPrompt.ts —
// duplicated on purpose (see the file-level comment above), but the JSON
// shape itself must match, since rerunExtractionAction below writes the
// result into the exact same visiting_cards columns the server's own
// extraction path does.
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
  "business_emails": [],
  "personal_emails": [],
  "phones": [],
  "fax": "",
  "websites": [],
  "addresses": [],
  "social_media": {
    "linkedin": "",
    "twitter": "",
    "facebook": ""
  },
  "qr_code_content": "",
  "additional_info": "",
  "confidence": 0.85,
  "notes": ""
}

Rules:
- Extract ONLY what is visible on the card (no guessing).
- Use exact spelling, formatting, and punctuation from the card.
- Return missing fields as "" (empty string) or [] (empty array) as appropriate.
- A card can genuinely have more than one phone number, email, website, or
  address — "phones", "business_emails", "personal_emails", "websites", and
  "addresses" are all arrays; include every distinct one you find as its
  own array entry rather than picking only one. Never invent duplicates
  just to fill the array.
- Order every array by prominence on the card, most important first (the
  person's own direct/mobile number before a shared office line, their own
  named email before a generic info@/contact@ one, the main company
  website before a secondary one, the primary printed address before a
  secondary branch). If nothing signals which is more prominent, keep the
  order they appear on the card, top-to-bottom then front-before-back.
- Phone numbers: include every number on the card (mobile, office, direct
  line) in "phones" — but not the fax number, which stays in its own "fax"
  field. Normalize each number to one consistent, clean format: keep the
  country code and digits exactly as shown, but present it consistently as
  "+<country code> <number>" with a single space after the country code and
  no other separators. If no country code is printed, include the number as
  shown with no invented country code.
- Emails: classify each email as BUSINESS (its domain matches the company
  name or the card's own website domain) or PERSONAL (a well-known free/
  consumer provider like gmail.com, yahoo.com, outlook.com, hotmail.com,
  icloud.com, protonmail.com, or otherwise clearly unrelated to the
  company's domain). Default to business_emails if genuinely unsure.
- Addresses: each entry in "addresses" should be one complete, readable,
  single-line address (street, city, state, postal code, country combined
  naturally with commas) — not a structured object.
- QR code: if the card has a QR code, read what it encodes into
  "qr_code_content". Leave it "" if there's no QR code or it can't be read.
- "additional_info": anything else printed on the card that doesn't fit any
  field above. Leave "" if there's nothing left over.
- Confidence must be between 0.5 and 1.0 based on clarity.`;

// Duplicated from server/src/integrations/ai/visionPrompt.ts's
// qrContextBlock, same reasoning as this file's own header comment. See
// there for the fuller explanation of why this exists.
function qrContextBlock(decodedQrContent: string | null): string {
  if (!decodedQrContent) return "";
  return (
    `\n\nThis card's QR code was already decoded separately (not by you) — its exact raw ` +
    `content is:\n"""\n${decodedQrContent}\n"""\n` +
    `Set "qr_code_content" to this exact string, verbatim — don't re-transcribe or paraphrase ` +
    `it, and don't second-guess it against what you see in the image. Many business-card QR ` +
    `codes encode a vCard (structured name/company/title/phone/email/address/website) or a ` +
    `contact/profile URL — parse it and use anything it contains to fill in fields you can't ` +
    `read clearly (or at all) from the card image itself; a phone/email/website/address found ` +
    `only in the QR still counts as a genuine value for that field's array, same as one you can ` +
    `see printed. Where the QR data and what's printed on the card disagree on the same field, ` +
    `prefer what's printed on the card (the QR data hasn't been verified as current) — but don't ` +
    `discard something the card itself leaves blank or illegible just because the QR is the only ` +
    `source for it.`
  );
}

function parseJsonResponse<T>(raw: string): T {
  let text = raw.trim().replace(/```json|```/g, "").trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return JSON.parse(text) as T;
}

async function downloadAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download card image: ${imageResponse.status}`);
  const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}

async function extractWithOpenAi(base64: string, mimeType: string, model: string, decodedQrContent: string | null): Promise<Record<string, unknown>> {
  const apiKey = await appEnvFiles.readEnvValue("server", "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not found in server/.env");

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT + qrContextBlock(decodedQrContent) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseJsonResponse<Record<string, unknown>>(raw);
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function extractWithGemini(base64: string, mimeType: string, model: string, decodedQrContent: string | null): Promise<Record<string, unknown>> {
  const apiKey = await appEnvFiles.readEnvValue("server", "GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not found in server/.env");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: EXTRACTION_PROMPT + qrContextBlock(decodedQrContent) }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini vision request failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as GeminiResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseJsonResponse<Record<string, unknown>>(raw);
}

export async function reExtractCardFromImageUrl(
  imageUrl: string,
  provider: ExtractionProvider,
  model: string,
): Promise<Record<string, unknown>> {
  const { base64, mimeType } = await downloadAsBase64(imageUrl);

  // Decoded before the vision call (cheap, local, no extra network round
  // trip) so it can be handed to the model as context — see
  // qrContextBlock's comment — instead of only being usable after the
  // fact. Falls back to whatever the model reads on its own if nothing
  // decodes.
  const decodedQr = decodeQrFromImage(Buffer.from(base64, "base64"), mimeType);

  const extracted =
    provider === "gemini"
      ? await extractWithGemini(base64, mimeType, model, decodedQr)
      : await extractWithOpenAi(base64, mimeType, model, decodedQr);

  // Still force the exact decoded string into qr_code_content afterward —
  // guarantees byte-for-byte fidelity regardless of how well the model
  // followed the "echo it verbatim" instruction. Only overrides when the
  // decoder actually found something.
  if (decodedQr) extracted.qr_code_content = decodedQr;

  return extracted;
}
