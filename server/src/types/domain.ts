// Mirrors the tables/views defined in db/schema.sql. Kept as plain
// interfaces (not generated) so the whole schema is readable in one place —
// see docs/DATABASE.md for the full column reference.

export type Channel = "whatsapp" | "telegram";

/** Conversation states we need to remember between two inbound messages.
 * Stored on users.user_state since a stateless webhook server can't keep a
 * paused n8n-style execution around waiting for the next reply. */
export type UserState =
  | "idle"
  | "awaiting_event_name"
  | "awaiting_account_settings_choice"
  // A photo was received with no active event (or the active one expired) —
  // waiting on an event_pick:<id>/event_pick:new choice. See
  // scanFlowService.ts; the pending media id lives on
  // pending_front_media_id, not in this state itself.
  | "awaiting_event_choice"
  // scan_both_sides is on and the front photo was just captured — waiting
  // on the back photo before finalizing the scan.
  | "awaiting_back_photo"
  // Waiting on a tap from the event-lifetime picker (1h/6h/.../Always),
  // shown from the account-settings menu.
  | "awaiting_event_lifetime_choice";

export interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  coin_balance: number;
  subscription_tier: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  last_coin_purchase: string | null;
  wa_id: string | null;
  wa_chat_id: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  active_event_id: string | null;
  active_visiting_card_id: string | null;
  write_email: boolean;
  user_state: UserState | null;
  export_sheet_id: string | null;
  blocked_at: string | null;
  marketing_opt_in: boolean;
}

export interface UserWithEvent {
  user_id: string;
  email: string | null;
  full_name: string | null;
  wa_id: string | null;
  wa_chat_id: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  coin_balance: number;
  active_event_id: string | null;
  active_event_name: string | null;
  active_visiting_card_id: string | null;
  active_card_name: string | null;
  active_card_company: string | null;
  write_email: boolean;
  subscription_tier: string | null;
  metadata: Record<string, unknown>;
  user_state: UserState | null;
  blocked_at: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
  export_sheet_id: string | null;
  // Resolved through channel_links/accounts when this channel identity is
  // linked to a dashboard login — see walletService.ts and the
  // "dashboard/ real accounts" block in schema.sql. account_id is null,
  // and the effective_* columns fall back to the legacy columns above,
  // for anyone who hasn't linked a channel.
  account_id: string | null;
  linked_account_email: string | null;
  effective_coin_balance: number;
  effective_blocked_at: string | null;
  effective_plan_id: string | null;
  effective_plan_expires_at: string | null;
  active_event_set_at: string | null;
  pending_front_media_id: string | null;
  pending_back_media_id: string | null;
  scan_both_sides: boolean | null;
  event_lifetime_hours: number | null;
}

/** A dashboard login — deliberately separate from `User`/`UserWithEvent`
 * (a bot channel identity). See the "dashboard/ real accounts" block in
 * db/schema.sql and docs/DASHBOARD_PLAN.md for the full identity model. */
export interface Account {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  password_hash: string | null;
  google_id: string | null;
  mobile: string | null;
  mobile_verified_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  blocked_at: string | null;
  onboarded_at: string | null;
  coin_balance: number;
  plan_id: string | null;
  plan_expires_at: string | null;
  scan_both_sides: boolean;
  event_lifetime_hours: number | null;
  created_at: string;
  updated_at: string;
}

export type ChannelLinkChannel = "whatsapp" | "telegram";

export interface ChannelLink {
  id: string;
  account_id: string;
  users_id: string;
  channel: ChannelLinkChannel;
  channel_identifier: string;
  verified_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  user_id: string | null;
  name: string;
  created_at: string;
}

export interface VisitingCard {
  id: string;
  user_id: string;
  event_id: string | null;
  full_name: string | null;
  position: string | null;
  company_name: string | null;
  address: string | null;
  phone1: string | null;
  phone2: string | null;
  business_email: string | null;
  personal_email: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  image_url: string | null;
  uploaded_by: Channel | null;
  message_id: string | null;
  transcribed_note: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  voice_note_path: string | null;
  storage_path: string | null;
  image_public_url: string | null;
  voice_note_public_url: string | null;
  extraction_confidence: number | null;
  back_storage_path: string | null;
  back_image_public_url: string | null;
}

export type TransactionType =
  | "card_scan"
  | "coin_purchase"
  | "coin_bonus"
  | "refund"
  | "admin_adjustment"
  | "subscription_payment";

export interface Transaction {
  id: string;
  user_id: string | null;
  account_id: string | null;
  type: TransactionType;
  coins: number;
  amount_inr: number | null;
  plan_id: string | null;
  status: "pending" | "completed" | "failed";
  cashfree_link_id: string | null;
  stripe_id: string | null;
  created_at: string;
}

/** Structured fields the vision model extracts from a business-card photo. */
export interface ExtractedCard {
  person_name: string;
  company_name: string;
  job_title: string;
  primary_email: string;
  secondary_email: string;
  primary_phone: string;
  secondary_phone: string;
  mobile_phone: string;
  fax: string;
  website: string;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  social_media: {
    linkedin: string;
    twitter: string;
    facebook: string;
  };
  confidence: number;
  notes: string;
}
