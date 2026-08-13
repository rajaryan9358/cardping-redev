import { Router } from "express";
import { cashfreeClient } from "../integrations/cashfree/client";
import { transactionsRepo } from "../db/repositories/transactions.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { whatsappClient } from "../integrations/whatsapp/client";
import { telegramClient } from "../integrations/telegram/client";
import { env } from "../config/env";
import { childLogger } from "../lib/logger";

export const cashfreeWebhookRouter = Router();
const log = childLogger("cashfree-webhook-route");

/** Cashfree Payment Link webhook. Configure this URL (`{PUBLIC_BASE_URL}
 * /webhooks/cashfree`) as the payment-link webhook endpoint in the
 * Cashfree merchant dashboard — Cashfree does not read `link_meta.notify_url`
 * from the create-link call for this event type, only the dashboard
 * setting, despite the field existing on the API (kept for parity with the
 * original n8n flow / a future direct-webhook-per-link setup). */
cashfreeWebhookRouter.post("/webhooks/cashfree", async (req, res) => {
  const signature = req.header("x-webhook-signature");
  const timestamp = req.header("x-webhook-timestamp");
  if (!cashfreeClient.verifyWebhookSignature(req.rawBody ?? Buffer.from(""), timestamp, signature)) {
    log.warn("rejected Cashfree webhook with invalid signature");
    res.sendStatus(401);
    return;
  }

  // Ack immediately — Cashfree retries on non-2xx/timeout, same as the
  // other two webhook providers.
  res.sendStatus(200);

  try {
    const body = req.body as any;
    const linkId: string | undefined = body?.data?.link_id ?? body?.data?.payment_link?.link_id;
    const status: string | undefined =
      body?.data?.link_status ?? body?.data?.payment_link?.link_status ?? body?.type;

    if (!linkId) {
      log.warn({ body }, "Cashfree webhook missing link_id — ignoring");
      return;
    }

    const transaction = await transactionsRepo.findByCashfreeLinkId(linkId);
    if (!transaction || !transaction.user_id) {
      log.warn({ linkId }, "Cashfree webhook for unknown link_id");
      return;
    }
    if (transaction.status !== "pending") {
      return; // already handled — Cashfree can send duplicate webhooks
    }

    const isPaid = status === "PAID" || status === "LINK_EVENT_PAID";
    if (!isPaid) {
      if (status === "EXPIRED" || status === "CANCELLED") {
        await transactionsRepo.markFailed(transaction.id);
      }
      return;
    }

    await usersRepo.incrementCoinBalance(transaction.user_id, transaction.coins);
    await transactionsRepo.markCompleted(transaction.id);

    const user = await usersRepo.findById(transaction.user_id);
    const confirmation = `✅ Payment received! ${transaction.coins} coins added to your balance.`;
    if (user?.wa_id) {
      await whatsappClient.sendText(env.WHATSAPP_PHONE_NUMBER_ID, user.wa_id, confirmation);
    }
    if (user?.telegram_chat_id) {
      await telegramClient.sendMessage(user.telegram_chat_id, confirmation);
    }
  } catch (err) {
    log.error({ err }, "failed to process Cashfree webhook");
  }
});
