// Mirrors the data model in docs/DASHBOARD_PLAN.md. Kept here so every page/component
// works against the same shape whether it's reading lib/mock/* today or a real
// server/ API response once the integration phase wires lib/data/* up for real.

export type Channel = "whatsapp" | "telegram";

export interface Account {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  mobile: string | null;
  role: "user" | "admin";
  coinBalance: number;
  planId: string | null;
  planExpiresAt: string | null;
  planBillingPeriod: "monthly" | "annual" | null;
  scanBothSides: boolean;
  eventLifetimeHours: number | null;
  marketingOptIn: boolean;
}

export interface ChannelLink {
  id: string;
  channel: Channel;
  identifier: string; // phone number or Telegram handle
  connectedAt: string;
}

export interface Session {
  id: string;
  deviceLabel: string;
  location: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface EventRecord {
  id: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  eventDate: string | null;
  thumbnailUrl: string | null;
  leadCount: number;
  isMiscellaneous: boolean;
  // The one real status: an owner/admin-controlled toggle. Also decides
  // whether the event is offered in an event *picker* (bot's Change Event
  // flow, the "move card to event" picker). "Upcoming" is not a stored
  // status — see isEventUpcoming() — it's a derived display label for an
  // active event whose date hasn't arrived yet.
  activeStatus: "active" | "inactive";
}

export interface VisitingCard {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  businessEmail: string | null;
  personalEmail: string | null;
  phone1: string | null;
  phone2: string | null;
  website: string | null;
  address: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  qrCodeContent: string | null;
  additionalInfo: string | null;
  imageUrl: string | null;
  imageBackUrl: string | null;
  tags: string[];
  archived: boolean;
  uploadedBy: Channel | null;
  eventId: string;
  eventName: string;
  scannedAt: string;
  extractionConfidence: number | null;
}

export interface InteractionEvent {
  id: string;
  cardId: string;
  label: string;
  occurredAt: string;
}

// A card can have any number of these — recorded by replying on WhatsApp/
// Telegram (to the card photo, its summary, its contact card, or a
// previous voice note's own confirmation — any of them, any time) or
// recorded directly from the dashboard's "Add new voice note" dialog.
export interface VoiceNote {
  id: string;
  url: string;
  transcript: string | null;
  recordedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  priceInr: number;
  annualPriceInr: number | null;
  periodDays: number;
  coinsIncluded: number;
  isCurrent: boolean;
}

export type TransactionStatus = "completed" | "pending" | "failed";
export type TransactionType = "subscription_payment" | "coin_purchase";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amountInr: number;
  status: TransactionStatus;
  occurredAt: string;
  invoiceId: string | null;
}
