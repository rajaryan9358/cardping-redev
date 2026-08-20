import { Router } from "express";
import { cashfreeClient } from "../integrations/cashfree/client";
import { transactionsRepo } from "../db/repositories/transactions.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { accountsRepo } from "../db/repositories/accounts.repo";
import { channelLinksRepo } from "../db/repositories/channelLinks.repo";
import { plansRepo } from "../db/repositories/plans.repo";
import { whatsappClient } from "../integrations/whatsapp/client";
import { telegramClient } from "../integrations/telegram/client";
import { generateForTransaction } from "../services/invoiceService";
import { Account } from "../types/domain";
import { env } from "../config/env";
import { childLogger } from "../lib/logger";
import { watchBackgroundTask } from "../lib/watchBackgroundTask";

/** Sends the same "payment received" confirmation to every channel linked
 * to this account — a dashboard-originated purchase has no single wa_id/
 * telegram_chat_id the way a legacy bot-triggered one does. */
async function notifyLinkedChannels(accountId: string, message: string): Promise<void> {
  const links = await channelLinksRepo.listByAccountId(accountId);
  await Promise.all(
    links.map((link) =>
      link.channel === "whatsapp"
        ? whatsappClient.sendText(env.WHATSAPP_PHONE_NUMBER_ID, link.channel_identifier, message)
        : telegramClient.sendMessage(link.channel_identifier, message),
    ),
  );
}

export const cashfreeWebhookRouter = Router();
const log = childLogger("cashfree-webhook-route");

/** Cashfree Payment Link webhook. Configure this URL (`{PUBLIC_BASE_URL}
 * /webhooks/cashfree`) as the payment-link webhook endpoint in the
 * Cashfree merchant dashboard — Cashfree does not read `link_meta.notify_url`
 * from the create-link call for this event type, only the dashboard
 * setting, despite the field existing on the API (kept for parity with the
 * original n8n flow / a future direct-webhook-per-link setup). */
async function processCashfreeWebhook(body: any): Promise<void> {
  const linkId: string | undefined = body?.data?.link_id ?? body?.data?.payment_link?.link_id;
  const status: string | undefined = body?.data?.link_status ?? body?.data?.payment_link?.link_status ?? body?.type;

  if (!linkId) {
    log.warn({ body }, "Cashfree webhook missing link_id — ignoring");
    return;
  }

  const transaction = await transactionsRepo.findByCashfreeLinkId(linkId);
  if (!transaction || (!transaction.user_id && !transaction.account_id)) {
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

  // Dashboard-originated purchase (subscription or account-scoped coin
  // top-up) — everything else below this branch is the original,
  // untouched legacy bot-triggered top-up path.
  if (transaction.account_id) {
    const account = await accountsRepo.findById(transaction.account_id);
    if (!account) {
      log.warn({ accountId: transaction.account_id }, "Cashfree webhook for unknown account");
      return;
    }

    let updatedAccount: Account = account;
    if (transaction.type === "subscription_payment" && transaction.plan_id) {
      const plan = await plansRepo.findById(transaction.plan_id);
      if (plan) {
        const base =
          account.plan_expires_at && new Date(account.plan_expires_at).getTime() > Date.now()
            ? new Date(account.plan_expires_at)
            : new Date();
        const expiresAt = new Date(base.getTime() + plan.period_days * 24 * 60 * 60 * 1000);
        await accountsRepo.update(account.id, { plan_id: plan.id, plan_expires_at: expiresAt.toISOString() });
        updatedAccount = await accountsRepo.incrementCoinBalance(account.id, plan.coins_included);
      }
    } else {
      updatedAccount = await accountsRepo.incrementCoinBalance(account.id, transaction.coins);
    }

    await transactionsRepo.markCompleted(transaction.id);

    const description =
      transaction.type === "subscription_payment" ? "Plan subscription" : `${transaction.coins} coin top-up`;
    try {
      await generateForTransaction(transaction, account, description);
    } catch (err) {
      log.error({ err, transactionId: transaction.id }, "invoice generation failed");
    }

    const confirmation =
      transaction.type === "subscription_payment"
        ? `✅ Payment received! Your plan is active — 🪙 ${updatedAccount.coin_balance} coins available.`
        : `✅ Payment received! ${transaction.coins} coins added — 🪙 ${updatedAccount.coin_balance} coins available.`;
    await notifyLinkedChannels(account.id, confirmation);
    return;
  }

  await usersRepo.incrementCoinBalance(transaction.user_id!, transaction.coins);
  await transactionsRepo.markCompleted(transaction.id);

  const user = await usersRepo.findById(transaction.user_id!);
  const confirmation = `✅ Payment received! ${transaction.coins} coins added to your balance.`;
  if (user?.wa_id) {
    await whatsappClient.sendText(env.WHATSAPP_PHONE_NUMBER_ID, user.wa_id, confirmation);
  }
  if (user?.telegram_chat_id) {
    await telegramClient.sendMessage(user.telegram_chat_id, confirmation);
  }
}

cashfreeWebhookRouter.post("/webhooks/cashfree", (req, res) => {
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

  watchBackgroundTask("cashfree-webhook", "Cashfree webhook processing", processCashfreeWebhook(req.body));
});
