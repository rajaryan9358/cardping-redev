import { Router } from "express";
import { z } from "zod";
import { env, isCashfreeEnabled } from "../../config/env";
import { invoicesRepo } from "../../db/repositories/invoices.repo";
import { plansRepo } from "../../db/repositories/plans.repo";
import { topupPackagesRepo } from "../../db/repositories/topupPackages.repo";
import { transactionsRepo } from "../../db/repositories/transactions.repo";
import { supabase } from "../../db/client";
import { cashfreeClient } from "../../integrations/cashfree/client";
import { requireSession } from "../../middleware/requireSession";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const billingRouter = Router();
const log = childLogger("api-billing-route");

billingRouter.get("/plans", requireSession, async (req, res) => {
  const plans = await plansRepo.listActive();
  res.json({ plans: plans.map((p) => ({ ...p, isCurrent: p.id === req.account!.plan_id })) });
});

billingRouter.get("/billing/topups", requireSession, async (_req, res) => {
  const topups = await topupPackagesRepo.listActive();
  res.json({ topups });
});

billingRouter.get("/billing/transactions", requireSession, async (req, res) => {
  const transactions = await transactionsRepo.listForAccount(req.account!.id);
  res.json({ transactions });
});

billingRouter.get("/billing/invoices", requireSession, async (req, res) => {
  const invoices = await invoicesRepo.listForAccount(req.account!.id);
  res.json({ invoices });
});

billingRouter.get("/billing/invoices/:id/pdf", requireSession, async (req, res) => {
  const invoice = await invoicesRepo.findByIdForAccount(req.params.id, req.account!.id);
  if (!invoice || !invoice.pdf_path) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(invoice.pdf_path, 60);
  if (error || !data) {
    log.error({ error }, "failed to sign invoice pdf url");
    res.status(500).json({ error: "signed_url_failed" });
    return;
  }
  res.redirect(data.signedUrl);
});

// A dashboard account may have no mobile on file (email/password or
// Google signup) — Cashfree's Payment Links API still requires some
// contact number, so this falls back to a placeholder sandbox-safe value
// rather than blocking checkout on "add a phone number first."
function customerPhone(mobile: string | null): string {
  return mobile ?? "9999999999";
}

// Set when checkout started from the bot-issued mobile /subscribe or
// /topup page (see magicLoginService.ts) — Cashfree only supports one
// static return_url per link, not a dynamic one, so this picks between the
// mobile status page (with its 3-second auto-return-to-channel) and the
// desktop dashboard's generic success page.
const returnToSchema = z.enum(["whatsapp", "telegram"]).optional();

function buildReturnUrl(kind: "topup" | "subscribe", returnTo: "whatsapp" | "telegram" | undefined): string | undefined {
  if (!returnTo) return undefined;
  return `${env.PUBLIC_BASE_URL}/${kind}/status?returnTo=${returnTo}`;
}

const subscribeSchema = z.object({ planId: z.string(), returnTo: returnToSchema });

billingRouter.post("/billing/subscribe", requireSession, async (req, res) => {
  const body = parseBody(subscribeSchema, req, res);
  if (!body) return;
  if (!isCashfreeEnabled) {
    res.status(501).json({ error: "billing_not_configured" });
    return;
  }

  try {
    const plan = await plansRepo.findById(body.planId);
    if (!plan) {
      res.status(404).json({ error: "plan_not_found" });
      return;
    }
    const account = req.account!;
    const link = await cashfreeClient.createPaymentLink({
      amountInr: plan.price_inr,
      purpose: `CardPing ${plan.name} plan`,
      phoneNumber: customerPhone(account.mobile),
      customerEmail: account.email ?? undefined,
      notifyUrl: `${env.PUBLIC_BASE_URL}/webhooks/cashfree`,
      returnUrl: buildReturnUrl("subscribe", body.returnTo),
    });
    await transactionsRepo.createPendingAccountPurchase({
      accountId: account.id,
      type: "subscription_payment",
      coins: plan.coins_included,
      amountInr: plan.price_inr,
      planId: plan.id,
      cashfreeLinkId: link.linkId,
    });
    res.json({ paymentLinkUrl: link.linkUrl });
  } catch (err) {
    log.error({ err }, "create subscription link failed");
    res.status(500).json({ error: "subscribe_failed" });
  }
});

const topupSchema = z.object({ topupPackageId: z.string(), returnTo: returnToSchema });

billingRouter.post("/billing/coins/topup", requireSession, async (req, res) => {
  const body = parseBody(topupSchema, req, res);
  if (!body) return;
  if (!isCashfreeEnabled) {
    res.status(501).json({ error: "billing_not_configured" });
    return;
  }

  try {
    const pkg = await topupPackagesRepo.findById(body.topupPackageId);
    if (!pkg) {
      res.status(404).json({ error: "package_not_found" });
      return;
    }
    const account = req.account!;
    const link = await cashfreeClient.createPaymentLink({
      amountInr: pkg.price_inr,
      purpose: `CardPing ${pkg.coins} coin top-up`,
      phoneNumber: customerPhone(account.mobile),
      customerEmail: account.email ?? undefined,
      notifyUrl: `${env.PUBLIC_BASE_URL}/webhooks/cashfree`,
      returnUrl: buildReturnUrl("topup", body.returnTo),
    });
    await transactionsRepo.createPendingAccountPurchase({
      accountId: account.id,
      type: "coin_purchase",
      coins: pkg.coins,
      amountInr: pkg.price_inr,
      planId: null,
      cashfreeLinkId: link.linkId,
    });
    res.json({ paymentLinkUrl: link.linkUrl });
  } catch (err) {
    log.error({ err }, "create topup link failed");
    res.status(500).json({ error: "topup_failed" });
  }
});
