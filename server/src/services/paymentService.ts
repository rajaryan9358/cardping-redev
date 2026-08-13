import { env } from "../config/env";
import { transactionsRepo } from "../db/repositories/transactions.repo";
import { cashfreeClient } from "../integrations/cashfree/client";

/** Creates a Cashfree top-up link and a matching pending transaction row,
 * so the /webhooks/cashfree callback can find it and credit coins once
 * the payment completes (see routes/cashfreeWebhook.route.ts). */
export async function createTopUpLink(userId: string, phoneNumber: string): Promise<string> {
  const link = await cashfreeClient.createPaymentLink({
    phoneNumber,
    notifyUrl: `${env.PUBLIC_BASE_URL}/webhooks/cashfree`,
  });
  await transactionsRepo.createPendingPurchase(userId, env.COIN_TOPUP_COINS, link.linkId);
  return link.linkUrl;
}
