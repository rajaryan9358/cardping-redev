import { EventRecord } from "./types";

/** "Upcoming" isn't a stored status — it's an active event whose date
 * hasn't arrived yet. Used for display badges/filters only. Kept in its
 * own file (no server-only imports) since it's used from client
 * components (EventsClient.tsx) as well as server ones — lib/data/events.ts
 * pulls in serverFetch's "server-only" import, which breaks client
 * bundling for anything that imports from that file at all, even a pure
 * function with no actual server dependency. */
export function isEventUpcoming(event: Pick<EventRecord, "activeStatus" | "eventDate">): boolean {
  return event.activeStatus === "active" && !!event.eventDate && new Date(event.eventDate) > new Date();
}
