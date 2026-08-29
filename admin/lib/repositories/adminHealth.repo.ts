import "server-only";
import { supabase } from "../supabase";
import { env } from "../env";
import { CHANNELS, CHANNEL_ID_COLUMN } from "../channels";

// coin_bonus/refund dropped per product decision — rare/manual enough
// that they're not worth a permanent tile. subscription_payment added —
// it's a real transaction_type (see schema.sql's "Manual subscription
// bookkeeping" comment) that was simply missing from this list, so a plan
// purchase/change never showed up here at all. card_scan is kept (still
// the clearest "is this channel actually being used" signal) but its
// tile no longer shows the raw "-1 credits" — every scan is the same
// -1, so the number added no information, just noise (see page.tsx).
const TRANSACTION_TYPES = ["card_scan", "subscription_payment", "coin_purchase", "admin_adjustment"] as const;

/** "Last seen" = last time this channel identity sent the bot ANY inbound
 * message (users.last_login, touched by usersRepo.findOrCreate on every
 * webhook — see server/src/db/repositories/users.repo.ts#touchLastLogin),
 * not the last time a scan happened to succeed. A channel can be very
 * much alive (browsing the menu, setting an event, buying credits)
 * without a single card scan in between, so scan recency alone was a
 * misleading proxy for whether a channel is actually connected/responsive. */
async function getLastSeenByChannel() {
  const results = await Promise.all(
    CHANNELS.map(async (channel) => {
      const idColumn = CHANNEL_ID_COLUMN[channel];
      const { data, error } = await supabase
        .from("users")
        .select("last_login")
        .not(idColumn, "is", null)
        .not("last_login", "is", null)
        .order("last_login", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { channel, lastSeenAt: data?.last_login ?? null };
    }),
  );
  return results;
}

async function getLastTransactionByType() {
  const results = await Promise.all(
    TRANSACTION_TYPES.map(async (type) => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, coins, created_at, amount_inr")
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { type, lastTransaction: data };
    }),
  );
  return results;
}

async function getScanVolumeByDay(days: number): Promise<{ date: string; count: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("visiting_cards")
    .select("created_at")
    .gte("created_at", since.toISOString());
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const buckets: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return buckets;
}

export interface ServerHealthResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

async function pingServerHealth(): Promise<ServerHealthResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(env.SERVER_HEALTH_URL, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unreachable" };
  }
}

export const adminHealthRepo = {
  getLastSeenByChannel,
  getLastTransactionByType,
  getScanVolumeByDay,
  pingServerHealth,
};
