import "server-only";
import { BroadcastField } from "./broadcastFields";

export interface RecipientFieldData {
  full_name: string | null;
  wa_id: string | null;
  effective_coin_balance: number;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
}

// Meta rejects an empty-string or newline-containing template parameter
// outright — every field must resolve to a non-empty, single-line string.
// Mirrors the existing `user.full_name || "there"` fallback convention
// (users/actions.ts's sendLowBalanceAlertAction, SendMessageModal.tsx).
export function sanitizeForWhatsApp(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, " ").trim();
  return cleaned || "there";
}

function resolveSubscriptionLabel(r: RecipientFieldData, planNamesById: Map<string, string>): string {
  if (!r.effective_plan_id) return "no active plan";
  const name = planNamesById.get(r.effective_plan_id) ?? "a plan";
  const active = !!r.effective_plan_expires_at && new Date(r.effective_plan_expires_at).getTime() > Date.now();
  return `${name} (${active ? "active" : "expired"})`;
}

/** field -> resolved display string, for either a WhatsApp template
 * parameter or a Telegram {{token}} substitution. Every branch must
 * return a non-empty, single-line string — see sanitizeForWhatsApp. */
export function resolveField(field: BroadcastField, recipient: RecipientFieldData, planNamesById: Map<string, string>): string {
  switch (field) {
    case "full_name":
      return sanitizeForWhatsApp(recipient.full_name || "there");
    case "wa_id":
      return sanitizeForWhatsApp(recipient.wa_id || "your number on file");
    case "coin_balance":
      return String(recipient.effective_coin_balance);
    case "subscription":
      return sanitizeForWhatsApp(resolveSubscriptionLabel(recipient, planNamesById));
  }
}

// parse_mode: "HTML" (broadcastSend.ts's sendTelegramBroadcastMessage)
// means any substituted value — and any literal text the admin typed
// around a token — must be HTML-escaped, or a stray `<`/`&` breaks
// rendering or gets interpreted as a tag.
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const KNOWN_FIELDS: readonly BroadcastField[] = ["full_name", "wa_id", "coin_balance", "subscription"];

/** Substitutes `{{field_name}}` tokens in a free-text Telegram message —
 * a distinct namespace from WhatsApp's numeric `{{1}}`/`{{2}}` slots,
 * never parsed together. Escapes the template's literal text FIRST, then
 * substitutes already-escaped field values into it, so admin-typed
 * `<`/`&` also render safely and an unknown/stale token (e.g. from a
 * field that's since been removed) passes through as literal text
 * instead of crashing the send. */
export function substituteTelegramTokens(template: string, recipient: RecipientFieldData, planNamesById: Map<string, string>): string {
  const escapedTemplate = escapeTelegramHtml(template);
  return escapedTemplate.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (!(KNOWN_FIELDS as readonly string[]).includes(name)) return match;
    return escapeTelegramHtml(resolveField(name as BroadcastField, recipient, planNamesById));
  });
}

/** Builds the natural, free-text version of a WhatsApp template's body —
 * substitutes already-resolved `variables[]` into the template's numeric
 * `{{n}}` slots (1-indexed, matching Meta's convention). Used for a
 * recipient inside their 24h customer-service window, where a plain
 * message is both allowed and more natural than the formal template
 * mechanism (see broadcastJob.ts). Plain string substitution — WhatsApp's
 * free-text send has no HTML/markup escaping requirement, unlike Telegram. */
export function fillTemplateBody(bodyText: string, variables: string[]): string {
  return bodyText.replace(/\{\{(\d+)\}\}/g, (match, n: string) => variables[Number(n) - 1] ?? match);
}
