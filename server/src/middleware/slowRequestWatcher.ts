import { RequestHandler } from "express";
import { childLogger } from "../lib/logger";
import { sendOpsAlert } from "../lib/opsAlert";

const log = childLogger("slow-request");

// pino-http already logs every request's responseTime at 'info', but that
// makes a genuinely slow request indistinguishable from routine traffic
// without grepping every line — this re-flags anything over WARN_MS at
// 'warn' (easy to filter for) and pushes a Telegram alert past ALERT_MS,
// the level that actually risks a user-visible nginx gateway timeout (see
// the investigation that led here: a 60s-aborted signup, default nginx
// proxy_read_timeout).
const WARN_MS = 3_000;
const ALERT_MS = 15_000;

export const slowRequestWatcher: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    if (durationMs < WARN_MS) return;

    log.warn({ method: req.method, url: req.originalUrl, durationMs, statusCode: res.statusCode }, "slow request");

    if (durationMs >= ALERT_MS) {
      void sendOpsAlert(
        "slow-request",
        `🐢 CardPing: slow request — ${req.method} ${req.originalUrl} took ${(durationMs / 1000).toFixed(1)}s (status ${res.statusCode})`,
      );
    }
  });
  next();
};
