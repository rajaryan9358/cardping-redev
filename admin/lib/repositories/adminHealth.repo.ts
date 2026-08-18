import "server-only";
import { supabase } from "../supabase";
import { env } from "../env";

// Not imported from server/'s domain types — admin/ never imports from
// server/, see the plan's isolation note (a compromised internet-facing
// server/ shouldn't be able to reach into admin/'s process either way, and
// keeping the two apps' dependency graphs disjoint is what guarantees that).
const CHANNELS = ["whatsapp", "telegram"] as const;
const TRANSACTION_TYPES = ["card_scan", "coin_purchase", "coin_bonus", "refund", "admin_adjustment"] as const;

async function getLastScanByChannel() {
  const results = await Promise.all(
    CHANNELS.map(async (channel) => {
      const { data, error } = await supabase
        .from("visiting_cards")
        .select("id, full_name, created_at")
        .eq("uploaded_by", channel)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { channel, lastCard: data };
    }),
  );
  return results;
}

async function getLastTransactionByType() {
  const results = await Promise.all(
    TRANSACTION_TYPES.map(async (type) => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, coins, created_at")
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
  getLastScanByChannel,
  getLastTransactionByType,
  getScanVolumeByDay,
  pingServerHealth,
};
