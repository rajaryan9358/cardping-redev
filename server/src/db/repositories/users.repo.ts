import { supabase } from "../client";
import { Channel, User, UserState, UserWithEvent } from "../../types/domain";

async function findByChannelId(channel: Channel, channelId: string): Promise<UserWithEvent | null> {
  const column = channel === "whatsapp" ? "wa_id" : "telegram_id";
  const { data, error } = await supabase
    .from("user_with_event")
    .select("*")
    .eq(column, channelId)
    .maybeSingle();

  if (error) throw error;
  return data as UserWithEvent | null;
}

async function createForChannel(
  channel: Channel,
  channelId: string,
  chatId: string,
  displayName: string | null,
): Promise<User> {
  const insert =
    channel === "whatsapp"
      ? { wa_id: channelId, wa_chat_id: chatId }
      : { telegram_id: channelId, telegram_chat_id: chatId };

  const { data, error } = await supabase
    .from("users")
    .insert({
      ...insert,
      full_name: displayName,
      // Not a starter grant — a channel identity can't scan anything until
      // it's linked to an account (see whatsapp/router.ts and
      // telegram/router.ts: "no scanning until they link"), so there's no
      // legitimate pre-link use for a nonzero balance here. The one-time
      // starter bonus is granted exactly once, account-wide, by
      // onboardingService.completeOnboarding — giving a fresh identity its
      // own full balance too just meant walletService.mergeLegacyBalanceOnLink
      // silently granted a second (or third, per additional channel linked)
      // copy of it on top when the channel connected.
      coin_balance: 0,
      last_login: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as User;
}

/** Finds-or-creates a user by channel identity. Mirrors the "User Exists?"
 * branch in both original bots. `displayName` (from the WhatsApp contact
 * profile or Telegram first/last name) is only used the first time we see
 * this person, to seed users.full_name for the email follow-up feature. */
async function findOrCreate(
  channel: Channel,
  channelId: string,
  chatId: string,
  displayName: string | null = null,
): Promise<UserWithEvent> {
  const existing = await findByChannelId(channel, channelId);
  if (existing) {
    await touchLastLogin(existing.user_id);
    return existing;
  }

  const created = await createForChannel(channel, channelId, chatId, displayName);
  const withEvent = await findByChannelId(channel, channelId);
  if (!withEvent) {
    // user_with_event is a plain view over the row we just inserted, so this
    // should never happen — surfacing it loudly beats silently returning
    // a half-populated object.
    throw new Error(`user_with_event lookup failed right after creating user ${created.id}`);
  }
  return withEvent;
}

async function findById(userId: string): Promise<UserWithEvent | null> {
  const { data, error } = await supabase
    .from("user_with_event")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserWithEvent | null;
}

async function touchLastLogin(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ last_login: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Stamps active_event_set_at alongside active_event_id — the single choke
 * point every "set the active event" path (typed name, picked from the
 * recent-events list) goes through via eventService.ts, so event-lifetime
 * expiry (see isEventExpired) can be computed off one timestamp regardless
 * of how the event was set.
 *
 * Writes to the ACCOUNT when this channel identity is linked to one
 * (accountId non-null) — current event is account-wide once an account
 * exists, shared across every channel linked to it and immune to any one
 * of them disconnecting/reconnecting (see user_with_event's coalesce).
 * Writes to the per-channel `users` row only as the bot-only fallback,
 * same as before this existed. */
async function setActiveEvent(userId: string, eventId: string, accountId: string | null): Promise<void> {
  if (accountId) {
    const { error } = await supabase
      .from("accounts")
      .update({ active_event_id: eventId, active_event_set_at: new Date().toISOString() })
      .eq("id", accountId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("users")
    .update({ active_event_id: eventId, active_event_set_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Holds a photo's channel media reference (WhatsApp mediaId / Telegram
 * photoFileId) across turns instead of discarding it — see
 * scanFlowService.ts. Pass null for either side to clear it (e.g. once the
 * scan finishes and processes both, or resumes to completion). */
async function setPendingMedia(userId: string, frontMediaId: string | null, backMediaId: string | null): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ pending_front_media_id: frontMediaId, pending_back_media_id: backMediaId })
    .eq("id", userId);
  if (error) throw error;
}

async function setActiveVisitingCard(userId: string, visitingCardId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ active_visiting_card_id: visitingCardId })
    .eq("id", userId);
  if (error) throw error;
}

async function setState(userId: string, state: UserState): Promise<void> {
  const { error } = await supabase.from("users").update({ user_state: state }).eq("id", userId);
  if (error) throw error;
}

async function setMarketingOptIn(userId: string, optIn: boolean): Promise<void> {
  const { error } = await supabase.from("users").update({ marketing_opt_in: optIn }).eq("id", userId);
  if (error) throw error;
}

async function decrementCoinBalance(userId: string): Promise<User> {
  const { data, error } = await supabase.rpc("decrement_coin_balance", { user_uuid: userId });
  if (error) throw error;
  return data as User;
}

async function incrementCoinBalance(userId: string, amount: number): Promise<User> {
  const { data, error } = await supabase.rpc("increment_coin_balance", {
    user_uuid: userId,
    amount,
  });
  if (error) throw error;
  return data as User;
}

/** Direct set, not the increment/decrement RPCs — used once, by
 * walletService's merge-on-link transfer, to zero the legacy balance
 * after it's been moved to the newly-linked account. */
async function setCoinBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase.from("users").update({ coin_balance: balance }).eq("id", userId);
  if (error) throw error;
}

export const usersRepo = {
  findByChannelId,
  findById,
  findOrCreate,
  setActiveEvent,
  setPendingMedia,
  setActiveVisitingCard,
  setState,
  setMarketingOptIn,
  decrementCoinBalance,
  incrementCoinBalance,
  setCoinBalance,
};
