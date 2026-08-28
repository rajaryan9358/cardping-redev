// Shared by every vision provider (openai/vision.ts, gemini/vision.ts) so
// a provider switch changes only which model runs, not what it's asked —
// otherwise a prompt difference would confound the accuracy comparison
// the ai_provider_usage_log table exists to support.

// Originally ported verbatim from the WhatsApp bot's "Analyze image" node;
// since extended to collect every value of a repeated field (a card can
// legitimately have two phone numbers, a business + personal email, or a
// different address on each side) instead of picking just one, to classify
// emails as business vs. personal instead of a naive first/second split,
// and to capture a QR code's content and any leftover text separately.
export const EXTRACTION_PROMPT = `You are an expert at extracting contact information from business cards.

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
  just to fill the array — an entry that appears twice (e.g. the same
  number printed on both the front and back) is still only ONE entry.
- Order every array by prominence on the card, most important first: the
  person's own direct/mobile number before a shared office line, their own
  named email before a generic one (info@/contact@), the main company
  website before a secondary one (e.g. a personal portfolio or a specific
  product site), the card's primary printed address before a secondary
  branch/location. If nothing on the card signals which is more prominent
  (equal size/placement, no labels), keep the order they appear on the
  card, reading top-to-bottom then front-before-back.
- Phone numbers: include every number on the card (mobile, office, direct
  line) in "phones" — but not the fax number, which stays in its own "fax"
  field. Normalize each number to one consistent, clean format: keep the
  country code and digits exactly as shown, but present it consistently as
  "+<country code> <number>" with a single space after the country code and
  no other separators (no dashes, dots, or extra spaces) — e.g. a card
  showing "+91-98765 43210" or "(+91) 98765-43210" both become
  "+91 9876543210". If no country code is printed, include the number as
  shown with no invented country code.
- Emails: classify each email you find as either business or personal.
  An email is BUSINESS if its domain matches the company name or the
  card's own website domain (e.g. "priya@acme.com" when the company is
  "Acme Corp" or the website is "acme.com"). An email is PERSONAL if it's
  on a well-known free/consumer email provider (gmail.com, yahoo.com,
  outlook.com, hotmail.com, icloud.com, protonmail.com, and similar) or
  otherwise clearly unrelated to the company's own domain. If you
  genuinely cannot tell, default to business_emails.
- Addresses: each entry in "addresses" should be one complete, readable,
  single-line address (street, city, state, postal code, country combined
  naturally with commas) — not a structured object. If the front and back
  show different addresses, include both as separate entries; if they show
  the same address, include it once.
- QR code: if the card has a QR code, read what it encodes (a URL, a
  vCard, plain text — whatever it actually contains) into
  "qr_code_content". Leave it "" if there's no QR code or it can't be
  read clearly.
- "additional_info": anything else printed on the card that doesn't fit
  any field above — a tagline, certifications, a secondary business unit,
  an extension number, awards, or similar. Leave "" if there's nothing
  left over. This is not a place to repeat information already captured
  in another field.
- Confidence must be between 0.5 and 1.0 based on clarity.`;

export const DUAL_SIDE_PROMPT =
  "\n\nThe two images are the front and back of the SAME business card. Combine information " +
  "from both sides into one set of fields — every genuinely distinct phone number, email, or " +
  "address found on either side belongs in the result (see the array fields above), not just " +
  "the first one you see. Only fold two sides together into a single value for a field that " +
  "isn't an array (e.g. person_name, company_name) when they agree; if they disagree, prefer " +
  "whichever side is clearer/more complete.";

/** Appended to the prompt when a QR code on this card was already decoded
 * deterministically (see integrations/qr/decode.ts) before this vision
 * call ran — handing the model the exact raw content up front rather than
 * asking it to visually "read" the QR itself, which it's fundamentally
 * unreliable at (see qr/decode.ts's own header comment). A business-card
 * QR very often encodes a vCard or a contact/profile URL carrying fields
 * the printed card doesn't show clearly (or at all) — this lets the model
 * mine that data to fill gaps instead of the QR's content sitting inert
 * in its own field. Returns "" (no-op) when nothing was decoded, so a
 * card with no QR — or one the decoder couldn't read — behaves exactly as
 * before this existed. */
export function qrContextBlock(decodedQrContent: string | null | undefined): string {
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
