import { eventsRepo } from "../db/repositories/events.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { EventRow, UserWithEvent } from "../types/domain";

/** True when the account's event_lifetime_hours preference has elapsed
 * since the active event was set — treated identically to "no active
 * event" by scanFlowService.ts (null lifetime = never expires). */
export function isEventExpired(user: UserWithEvent): boolean {
  if (!user.active_event_id || !user.active_event_set_at || !user.event_lifetime_hours) return false;
  const expiresAt = new Date(user.active_event_set_at).getTime() + user.event_lifetime_hours * 60 * 60 * 1000;
  return Date.now() > expiresAt;
}

export async function setActiveEvent(userId: string, name: string): Promise<EventRow> {
  const event = await eventsRepo.create(userId, name);
  await usersRepo.setActiveEvent(userId, event.id);
  return event;
}

/** Reuses an existing event (picked from the recent-events list) instead of
 * creating a new one — see scanFlowService.ts's event picker. */
export async function setActiveEventById(userId: string, eventId: string): Promise<void> {
  await usersRepo.setActiveEvent(userId, eventId);
}
