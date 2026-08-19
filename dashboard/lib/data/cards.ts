// Data-access layer: pages import from here, never from lib/mock/* directly.
// Bodies now call server/'s real /api/*.

import { redirectIfPaywalled, serverFetch } from "../serverFetch";
import { Channel, InteractionEvent, VisitingCard } from "../types";

interface ServerCard {
  id: string;
  full_name: string | null;
  position: string | null;
  company_name: string | null;
  business_email: string | null;
  personal_email: string | null;
  phone1: string | null;
  phone2: string | null;
  website: string | null;
  address: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  image_public_url: string | null;
  back_image_public_url: string | null;
  voice_note_public_url: string | null;
  transcribed_note: string | null;
  tags: string[];
  archived: boolean;
  uploaded_by: Channel;
  event_id: string | null;
  event: { id: string; name: string } | null;
  created_at: string;
  extraction_confidence: number | null;
}

function mapCard(c: ServerCard): VisitingCard {
  return {
    id: c.id,
    fullName: c.full_name ?? "Unknown",
    jobTitle: c.position,
    companyName: c.company_name,
    businessEmail: c.business_email,
    personalEmail: c.personal_email,
    phone1: c.phone1,
    phone2: c.phone2,
    website: c.website,
    address: c.address,
    linkedin: c.linkedin,
    twitter: c.twitter,
    facebook: c.facebook,
    instagram: c.instagram,
    imageUrl: c.image_public_url,
    imageBackUrl: c.back_image_public_url,
    voiceNoteUrl: c.voice_note_public_url,
    transcribedNote: c.transcribed_note,
    tags: c.tags,
    archived: c.archived,
    uploadedBy: c.uploaded_by,
    eventId: c.event?.id ?? c.event_id ?? "misc",
    eventName: c.event?.name ?? "Miscellaneous",
    scannedAt: c.created_at,
    extractionConfidence: c.extraction_confidence,
  };
}

export interface CardFilters {
  query?: string;
  eventId?: string;
  tag?: string;
  archived?: boolean;
}

export async function getCards(filters: CardFilters = {}): Promise<VisitingCard[]> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.eventId) params.set("eventId", filters.eventId);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.archived !== undefined) params.set("archived", String(filters.archived));
  params.set("pageSize", "1000"); // ScansExplorer paginates client-side over the full set

  const res = await serverFetch(`/api/cards?${params.toString()}`);
  redirectIfPaywalled(res);
  if (!res.ok) return [];
  const { cards } = (await res.json()) as { cards: ServerCard[] };
  return cards.map(mapCard);
}

export async function getCard(cardId: string): Promise<VisitingCard | null> {
  const res = await serverFetch(`/api/cards/${cardId}`);
  if (!res.ok) return null;
  const { card } = (await res.json()) as { card: ServerCard };
  return mapCard(card);
}

export async function getRecentCards(limit = 6): Promise<VisitingCard[]> {
  const res = await serverFetch("/api/home/summary");
  redirectIfPaywalled(res);
  if (!res.ok) return [];
  const { recentCards } = (await res.json()) as { recentCards: ServerCard[] };
  return recentCards.slice(0, limit).map(mapCard);
}

// No backing table exists for a per-card interaction timeline (not
// specified anywhere in docs/DASHBOARD_PLAN.md's data model) — returns
// empty rather than inventing one; see the contact-detail page, which
// already renders an empty state for this.
export async function getInteractions(_cardId: string): Promise<InteractionEvent[]> {
  return [];
}

export function allTags(cards: VisitingCard[]): string[] {
  return Array.from(new Set(cards.flatMap((c) => c.tags))).sort();
}
