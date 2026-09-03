// Not "server-only" — imported by both the (server-only) broadcast job/repo
// and the (client) BroadcastComposer, same reasoning as audienceFilter.ts.

export type BroadcastField = "full_name" | "wa_id" | "coin_balance" | "subscription";

export interface FieldOption {
  field: BroadcastField;
  label: string;
  // No Telegram equivalent — wa_id doubles as "Phone" for WhatsApp, but a
  // Telegram identity has no phone number on file. Filtered out of the
  // Telegram picker, not just disabled, since it can never resolve there.
  whatsappOnly?: boolean;
}

export const BROADCAST_FIELD_OPTIONS: FieldOption[] = [
  { field: "full_name", label: "Name" },
  { field: "wa_id", label: "Phone", whatsappOnly: true },
  { field: "coin_balance", label: "Credits" },
  { field: "subscription", label: "Subscription" },
];

// A WhatsApp template's positional {{n}} slot is one atomic parameter —
// either a fixed literal the admin typed, or a field resolved per
// recipient at send time. No meaningful "half literal, half field" state
// for a single Meta template parameter.
export type SlotValue = { type: "literal"; value: string } | { type: "field"; field: BroadcastField };

// Lives here (not whatsappTemplates.ts, which is server-only) so the
// client-side composers can reference it without pulling a server-only
// module into the client bundle.
export type HeaderMediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

// The full shape stored in broadcast_campaigns.body for a WhatsApp
// campaign (JSON-encoded) — see broadcastJob.ts's normalizeWhatsAppBody
// for the legacy-shape fallback this also has to stay compatible with.
export interface WhatsAppBodyPayload {
  languageCode: string;
  slots: SlotValue[];
  // null for the manual-template-entry fallback and any pre-existing
  // campaign — both always go through the formal template send
  // regardless of the recipient's 24h window (see broadcastJob.ts).
  bodyText: string | null;
  // Present only when the template has a media header — every send then
  // needs headerMediaUrl to be non-empty, or Meta rejects it.
  headerMediaFormat: HeaderMediaFormat | null;
  headerMediaUrl: string | null;
}
