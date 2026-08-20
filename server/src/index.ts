import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { sendOpsAlert } from "./lib/opsAlert";
import { startResourceMonitor } from "./lib/resourceMonitor";

// Without these, an error outside Express's own request handling (a
// dangling promise, a callback that throws) crashes the process with
// whatever Node's default handler prints — often nothing useful in PM2's
// log by the time it's rotated past. Logging first, then always exiting:
// Node's own docs are explicit that continuing after uncaughtException
// risks running in a corrupted state, and PM2 restarts the process
// immediately anyway, so there's nothing to gain by not exiting. The
// ops-alert send races a timeout so a slow/unreachable Telegram API can
// never delay the crash-restart itself.
function crashAndExit(key: string, message: string, err: unknown): void {
  logger.fatal({ err }, message);
  const alert = sendOpsAlert(key, `🔴 CardPing server crashed — ${message}`);
  const timeout = new Promise((resolve) => setTimeout(resolve, 3_000));
  Promise.race([alert, timeout]).finally(() => process.exit(1));
}

process.on("uncaughtException", (err) => {
  crashAndExit("uncaught-exception", `uncaught exception: ${err.message}`, err);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  crashAndExit("unhandled-rejection", `unhandled promise rejection: ${message}`, reason);
});

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`CardPing server listening on port ${env.PORT}`);
  logger.info(`WhatsApp webhook: ${env.PUBLIC_BASE_URL}/webhooks/whatsapp`);
  logger.info(`Telegram webhook: ${env.PUBLIC_BASE_URL}/webhooks/telegram`);
});

startResourceMonitor();
