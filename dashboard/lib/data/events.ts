// Data-access layer: pages import from here, never from lib/mock/* directly.
// Bodies now call server/'s real /api/*.

import { redirectIfPaywalled, serverFetch } from "../serverFetch";
import { EventRecord } from "../types";

interface ServerEvent {
  id: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  event_date: string | null;
  thumbnail_public_url: string | null;
  created_at: string;
  leadCount: number;
  status: "active" | "inactive";
}

function mapEvent(e: ServerEvent): EventRecord {
  return {
    id: e.id,
    name: e.name,
    location: e.location,
    lat: e.lat,
    lng: e.lng,
    eventDate: e.event_date,
    thumbnailUrl: e.thumbnail_public_url,
    leadCount: e.leadCount,
    isMiscellaneous: false,
    activeStatus: e.status,
  };
}

/** "Upcoming" isn't a stored status — it's an active event whose date
 * hasn't arrived yet. Used for display badges/filters only. */
export function isEventUpcoming(event: Pick<EventRecord, "activeStatus" | "eventDate">): boolean {
  return event.activeStatus === "active" && !!event.eventDate && new Date(event.eventDate) > new Date();
}

export async function getEvents(query?: string): Promise<EventRecord[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : "";
  const res = await serverFetch(`/api/events${params}`);
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
