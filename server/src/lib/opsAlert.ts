import { telegramClient } from "../integrations/telegram/client";
import { env, isOpsAlertEnabled } from "../config/env";
import { childLogger } from "./logger";

const log = childLogger("ops-alert");

// Per-key cooldown so one incident (e.g. 50 slow requests in a row while
// Supabase is having a moment) sends a single Telegram message instead of
// fifty. Each call site picks its own key ("slow-request", "uncaught-
// exception", "resource-pressure", ...) — unrelated keys don't share a
// cooldown, but repeats of the *same* kind of problem do.
const lastSentAt = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

/** Best-effort — never throws, never blocks the caller on Telegram being
 * slow/down. Silently a no-op when OPS_ALERT_TELEGRAM_CHAT_ID isn't set. */
export async function sendOpsAlert(key: string, message: string): Promise<void> {
  if (!isOpsAlertEnabled) return;

  const now = Date.now();
  const last = lastSentAt.get(key) ?? 0;
  if (now - last < COOLDOWN_MS) return;
  lastSentAt.set(key, now);

  try {
    await telegramClient.sendMessage(env.OPS_ALERT_TELEGRAM_CHAT_ID, message);
  } catch (err) {
    log.error({ err }, "failed to send ops alert");
  }
}
