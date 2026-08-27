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

export async function setActiveEvent(userId: string, name: string, accountId: string | null): Promise<EventRow> {
  const event = await eventsRepo.create(userId, name);
  await usersRepo.setActiveEvent(userId, event.id, accountId);
  return event;
}

/** Reuses an existing event (picked from the recent-events list) instead of
 * creating a new one — see scanFlowService.ts's event picker. Returns the
 * event's name for the "Switched to X" confirmation. */
export async function setActiveEventById(userId: string, eventId: string, accountId: string | null): Promise<string> {
  await usersRepo.setActiveEvent(userId, eventId, accountId);
  const event = await eventsRepo.findById(eventId);
  return event?.name ?? "that event";
}

/** The active event, treating an expired one as unset — the single check
 * every "is there currently an active event" decision should go through
 * (menu label, the Set/Change Event branch, decideScanAction) so an
 * expired event reads as deselected everywhere consistently, not just at
 * scan time. */
export function effectiveActiveEventName(user: UserWithEvent): string | null {
  if (!user.active_event_id || isEventExpired(user)) return null;
  return user.active_event_name;
}

/** "18h left" / "no expiry" — used both right after setting an event (full
 * lifetime remaining) and on a scan result (actual time elapsed since). */
export function formatEventLifetimeRemaining(setAt: string | null, lifetimeHours: number | null): string {
  if (!lifetimeHours) return "no expiry";
  if (!setAt) return `${lifetimeHours}h`;
  const expiresAt = new Date(setAt).getTime() + lifetimeHours * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return "expired";
  const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return `${remainingHours}h left`;
}
