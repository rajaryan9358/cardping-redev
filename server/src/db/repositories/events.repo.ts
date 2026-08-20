import { supabase } from "../client";
import { EventRow } from "../../types/domain";

async function create(userId: string, name: string): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({ user_id: userId, name })
    .select("*")
    .single();

  if (error) throw error;
  return data as EventRow;
}

async function findById(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw error;
  return data as EventRow | null;
}

// ── dashboard/ account-scoped access ────────────────────────────────────
// Same "resolve via linked usersIds" pattern as visitingCards.repo.ts.

export interface DashboardEventRow {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  thumbnail_public_url: string | null;
  created_at: string;
  status: "active" | "inactive";
}

const DASHBOARD_EVENT_COLUMNS = "id, name, location, event_date, thumbnail_public_url, created_at, status";

async function listForAccount(usersIds: string[]): Promise<DashboardEventRow[]> {
  if (usersIds.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select(DASHBOARD_EVENT_COLUMNS)
    .in("user_id", usersIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DashboardEventRow[];
}

/** Same as listForAccount but restricted to status='active' — for event
 * *pickers* (bot's Change Event flow, dashboard's "move card to event"
 * picker), which shouldn't offer an event the owner has deliberately
 * deactivated. listForAccount stays unfiltered since the dashboard's own
 * Events page still needs to show/manage inactive events. */
async function listActiveForAccount(usersIds: string[]): Promise<DashboardEventRow[]> {
  if (usersIds.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select(DASHBOARD_EVENT_COLUMNS)
    .in("user_id", usersIds)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DashboardEventRow[];
}

async function findByIdForAccount(eventId: string, usersIds: string[]): Promise<DashboardEventRow | null> {
  if (usersIds.length === 0) return null;
  const { data, error } = await supabase
    .from("events")
    .select(DASHBOARD_EVENT_COLUMNS)
    .eq("id", eventId)
    .in("user_id", usersIds)
    .maybeSingle();
  if (error) throw error;
  return data as DashboardEventRow | null;
}

export interface EventUpdateInput {
  name?: string;
  location?: string | null;
  event_date?: string | null;
  thumbnail_path?: string | null;
  thumbnail_public_url?: string | null;
  status?: "active" | "inactive";
}

/** For the dashboard's "create event" flow — same table, but a dashboard
 * account has no single `users` row of its own to stamp as `user_id`, so
 * the caller passes whichever linked channel identity the new event
 * should attach to (the account's first linked channel is fine; events
 * created from the dashboard aren't tied to a specific channel the way a
 * bot-created one is). */
async function createForUsersId(usersId: string, input: { name: string } & EventUpdateInput): Promise<DashboardEventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({ user_id: usersId, ...input })
    .select(DASHBOARD_EVENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as DashboardEventRow;
}

async function updateForAccount(eventId: string, usersIds: string[], patch: EventUpdateInput): Promise<DashboardEventRow | null> {
  if (usersIds.length === 0) return null;
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .in("user_id", usersIds)
    .select(DASHBOARD_EVENT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data as DashboardEventRow | null;
}

async function countCardsForEvent(eventId: string, usersIds: string[]): Promise<number> {
  if (usersIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("visiting_cards")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("user_id", usersIds);
  if (error) throw error;
  return count ?? 0;
}

export const eventsRepo = {
  create,
  findById,
  listForAccount,
  listActiveForAccount,
  findByIdForAccount,
  createForUsersId,
  updateForAccount,
  countCardsForEvent,
};
