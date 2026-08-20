import { childLogger } from "./logger";
import { sendOpsAlert } from "./opsAlert";

// Background work (webhook processing that runs after the HTTP response
// already went out — see whatsappWebhook.route.ts/telegramWebhook.route.ts)
// has no request-response cycle for slowRequestWatcher.ts to time, and
// previously only got logged at all if it *threw*. A call that's merely
// slow but eventually succeeds — e.g. one of several sequential Supabase
// round-trips hitting a latency spike — left zero trace, which is exactly
// what happened in the incident this was added for: a first-time WhatsApp
// contact waited ~5 minutes for the bot's signup-link reply with nothing
// in the logs to explain why. Background work reasonably takes longer
// than an HTTP request before it's worth flagging, hence the higher
// thresholds than slowRequestWatcher's.
const WARN_MS = 5_000;
const ALERT_MS = 60_000;

/** Fire-and-forget wrapper — logs+times a task without the caller having
 * to await it (the whole point of "ack fast, process after" for a
 * webhook). Call, don't await; the task's own promise chain handles
 * everything from here. */
export function watchBackgroundTask(key: string, label: string, task: Promise<void>): void {
  const log = childLogger(key);
  const start = Date.now();

  task
    .then(() => {
      const durationMs = Date.now() - start;
      if (durationMs < WARN_MS) return;
      log.warn({ durationMs, label }, "slow background task");
      if (durationMs >= ALERT_MS) {
        void sendOpsAlert(`slow-background-${key}`, `🐢 CardPing: ${label} took ${(durationMs / 1000).toFixed(1)}s to complete`);
      }
    })
    .catch((err) => {
      const durationMs = Date.now() - start;
      log.error({ err, durationMs, label }, "background task failed");
      void sendOpsAlert(
        `background-failed-${key}`,
        `🔴 CardPing: ${label} failed after ${(durationMs / 1000).toFixed(1)}s — ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}
