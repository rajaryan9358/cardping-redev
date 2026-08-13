import { supabase } from "../client";
import { Channel, User, UserState, UserWithEvent } from "../../types/domain";
import { env } from "../../config/env";

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
      coin_balance: env.COINS_STARTER_BALANCE,
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

async function setActiveEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ active_event_id: eventId })
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

async function setWriteEmail(userId: string, writeEmail: boolean): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ write_email: writeEmail })
    .eq("id", userId);
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

export const usersRepo = {
  findByChannelId,
  findById,
  findOrCreate,
  setActiveEvent,
  setActiveVisitingCard,
  setState,
  setWriteEmail,
  decrementCoinBalance,
  incrementCoinBalance,
};
