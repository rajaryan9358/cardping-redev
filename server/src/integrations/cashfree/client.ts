import axios from "axios";
import crypto from "node:crypto";
import { env } from "../../config/env";

const cashfree = axios.create({
  baseURL: env.CASHFREE_BASE_URL,
  headers: {
    "x-client-id": env.CASHFREE_CLIENT_ID,
    "x-client-secret": env.CASHFREE_CLIENT_SECRET,
    "x-api-version": env.CASHFREE_API_VERSION,
    "Content-Type": "application/json",
  },
});

export interface CreatePaymentLinkResult {
  linkId: string;
  linkUrl: string;
}

/** Creates a one-time Cashfree Payment Link for a coin top-up. `notifyUrl`
 * is where Cashfree POSTs the payment status webhook (see
 * routes/cashfreeWebhook.route.ts) — Cashfree does not call back to a
 * dynamic `return_url`, only to whatever static webhook URL is configured
 * for the merchant account, so `notifyUrl` here is informational/legacy
 * from the original flow; configure the real one in the Cashfree dashboard. */
async function createPaymentLink(input: {
  phoneNumber: string;
  notifyUrl: string;
}): Promise<CreatePaymentLinkResult> {
  const linkId = crypto.randomUUID();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data } = await cashfree.post("/links", {
    link_id: linkId,
    link_amount: env.COIN_TOPUP_AMOUNT_INR,
    link_currency: "INR",
    link_purpose: "CardPing coin top-up",
    customer_details: {
      customer_name: "",
      customer_email: "",
      customer_phone: input.phoneNumber.replace(/\D/g, "").slice(-10),
    },
    link_expiry_time: expiry,
    link_notify: { send_email: false, send_sms: true },
    link_meta: { notify_url: input.notifyUrl, return_url: env.CASHFREE_RETURN_URL },
  });

  return { linkId, linkUrl: data.link_url };
}

async function getLinkStatus(linkId: string): Promise<string> {
  const { data } = await cashfree.get(`/links/${linkId}`);
  return data.link_status as string;
}

/** Verifies the `x-webhook-signature` header Cashfree sends on payment
 * webhooks: base64(HMAC-SHA256(timestamp + rawBody, client secret)). Skips
 * verification (with a warning) if no client secret is configured. */
function verifyWebhookSignature(
  rawBody: Buffer,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (!env.CASHFREE_CLIENT_SECRET) {
    return true;
  }
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", env.CASHFREE_CLIENT_SECRET)
    .update(timestamp + rawBody.toString())
    .digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const cashfreeClient = { createPaymentLink, getLinkStatus, verifyWebhookSignature };
