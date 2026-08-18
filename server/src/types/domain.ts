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
  | "awaiting_email_review"
  // Telegram-only: Cashfree payment links require a phone number, which a
  // Telegram user doesn't inherently expose (unlike a WhatsApp `wa_id`).
  | "awaiting_topup_phone";

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
}

export type TransactionType =
  | "card_scan"
  | "coin_purchase"
  | "coin_bonus"
  | "refund"
  | "admin_adjustment";

export interface Transaction {
  id: string;
  user_id: string | null;
  type: TransactionType;
  coins: number;
  status: "pending" | "completed" | "failed";
  cashfree_link_id: string | null;
  stripe_id: string | null;
  created_at: string;
}

export interface GmailTokens {
  id: string;
  user_id: string | null;
  refresh_token: string;
  client_id: string | null;
  client_secret: string | null;
  email_address: string | null;
  created_at: string;
}

export interface TempEmail {
  id: string;
  to: string;
  from: string | null;
  subject: string | null;
  body: string | null;
  visiting_card_id: string | null;
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
