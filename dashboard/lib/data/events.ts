// Data-access layer: pages import from here, never from lib/mock/* directly.
// Bodies now call server/'s real /api/*.

import { redirectIfPaywalled, serverFetch } from "../serverFetch";
import { EventRecord } from "../types";

interface ServerEvent {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  thumbnail_public_url: string | null;
  created_at: string;
  leadCount: number;
}

// Every real card requires an event to already be set before the bot
// accepts a scan (see server/src/bots/*/handlers/{image,photo}.ts), so
// there's no genuine "uncategorized" bucket the way the original mock
// data modeled with a synthetic "Miscellaneous" event — every event here
// is a real one the user named.
function deriveStatus(eventDate: string | null): EventRecord["status"] {
  if (!eventDate) return "draft";
  const date = new Date(eventDate);
  const now = new Date();
  const daysSince = (now.getTime() - date.getTime()) / 86_400_000;
  if (daysSince < 0) return "upcoming";
  if (daysSince <= 3) return "active";
  return "past";
}

function mapEvent(e: ServerEvent): EventRecord {
  return {
    id: e.id,
    name: e.name,
    location: e.location,
    eventDate: e.event_date,
    thumbnailUrl: e.thumbnail_public_url,
    leadCount: e.leadCount,
    isMiscellaneous: false,
    status: deriveStatus(e.event_date),
  };
}

export async function getEvents(): Promise<EventRecord[]> {
  const res = await serverFetch("/api/events");
  redirectIfPaywalled(res);
  if (!res.ok) return [];
  const { events } = (await res.json()) as { events: ServerEvent[] };
  return events.map(mapEvent);
}

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  const res = await serverFetch(`/api/events/${eventId}`);
  redirectIfPaywalled(res);
  if (!res.ok) return null;
  const { event } = (await res.json()) as { event: ServerEvent };
  return mapEvent(event);
}
