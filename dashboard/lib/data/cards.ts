import { mockCards, mockInteractions } from "../mock/cards";
import { InteractionEvent, VisitingCard } from "../types";

export interface CardFilters {
  query?: string;
  eventId?: string;
  tag?: string;
  archived?: boolean;
}

export async function getCards(filters: CardFilters = {}): Promise<VisitingCard[]> {
  return mockCards.filter((card) => {
    if (filters.eventId && card.eventId !== filters.eventId) return false;
    if (filters.tag && !card.tags.includes(filters.tag)) return false;
    if (filters.archived !== undefined && card.archived !== filters.archived) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const haystack = `${card.fullName} ${card.companyName ?? ""} ${card.jobTitle ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getCard(cardId: string): Promise<VisitingCard | null> {
  return mockCards.find((c) => c.id === cardId) ?? null;
}

export async function getRecentCards(limit = 6): Promise<VisitingCard[]> {
  return [...mockCards]
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, limit);
}

export async function getInteractions(cardId: string): Promise<InteractionEvent[]> {
  return mockInteractions.filter((i) => i.cardId === cardId);
}

export function allTags(cards: VisitingCard[]): string[] {
  return Array.from(new Set(cards.flatMap((c) => c.tags))).sort();
}
