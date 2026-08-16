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
  eventDate: string | null;
  thumbnailUrl: string | null;
  leadCount: number;
  isMiscellaneous: boolean;
  status: "active" | "upcoming" | "past" | "draft";
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
  imageUrl: string | null;
  imageBackUrl: string | null;
  voiceNoteUrl: string | null;
  transcribedNote: string | null;
  tags: string[];
  archived: boolean;
  uploadedBy: Channel;
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

export interface Plan {
  id: string;
  name: string;
  priceInr: number;
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
