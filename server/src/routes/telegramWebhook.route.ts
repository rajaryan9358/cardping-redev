import { Router } from "express";
import { env } from "../config/env";
import { routeTelegramUpdate } from "../bots/telegram/router";
import { childLogger } from "../lib/logger";
import { watchBackgroundTask } from "../lib/watchBackgroundTask";

export const telegramWebhookRouter = Router();
const log = childLogger("tg-webhook-route");

telegramWebhookRouter.post("/webhooks/telegram", (req, res) => {
  const secret = req.header("x-telegram-bot-api-secret-token");
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    log.warn("rejected Telegram webhook with invalid secret token");
    res.sendStatus(401);
    return;
  }

  // Telegram also expects a fast 200 — ack immediately, process after.
  res.sendStatus(200);

  watchBackgroundTask("tg-webhook", "Telegram webhook processing", routeTelegramUpdate(req.body));
});
