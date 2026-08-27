// Data-access layer: pages import from here, never from lib/mock/* directly.
// Bodies now call server/'s real /api/*.

import { serverFetch } from "../serverFetch";
import { Plan, Transaction, TransactionType } from "../types";
import { TopUpPackage } from "../mock/topups";

interface ServerPlan {
  id: string;
  name: string;
  price_inr: number;
  annual_monthly_price_inr: number | null;
  period_days: number;
  coins_included: number;
  isCurrent: boolean;
}

export async function getPlans(): Promise<Plan[]> {
  const res = await serverFetch("/api/plans");
  if (!res.ok) return [];
  const { plans } = (await res.json()) as { plans: ServerPlan[] };
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    priceInr: p.price_inr,
    annualMonthlyPriceInr: p.annual_monthly_price_inr,
    periodDays: p.period_days,
    coinsIncluded: p.coins_included,
    isCurrent: p.isCurrent,
  }));
}

interface ServerTopup {
  id: string;
  coins: number;
  price_inr: number;
  is_popular: boolean;
}

export async function getTopUpPackages(): Promise<TopUpPackage[]> {
  const res = await serverFetch("/api/billing/topups");
  if (!res.ok) return [];
  const { topups } = (await res.json()) as { topups: ServerTopup[] };
  return topups.map((t) => ({ id: t.id, coins: t.coins, priceInr: t.price_inr, popular: t.is_popular }));
}

interface ServerTransaction {
  id: string;
  type: TransactionType | "card_scan" | "coin_bonus" | "refund" | "admin_adjustment";
  coins: number;
  amount_inr: number | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

interface ServerInvoice {
  id: string;
  transaction_id: string;
}

const DESCRIPTIONS: Record<string, string> = {
  card_scan: "Card scan",
  coin_purchase: "Credit top-up",
  coin_bonus: "Bonus credits",
  refund: "Refund",
  admin_adjustment: "Balance adjustment",
  subscription_payment: "Plan subscription",
};

export async function getTransactions(): Promise<Transaction[]> {
  const [txRes, invRes] = await Promise.all([
    serverFetch("/api/billing/transactions"),
    serverFetch("/api/billing/invoices"),
  ]);
  if (!txRes.ok) return [];
  const { transactions } = (await txRes.json()) as { transactions: ServerTransaction[] };
  const invoicesByTxId = new Map<string, string>();
  if (invRes.ok) {
    const { invoices } = (await invRes.json()) as { invoices: ServerInvoice[] };
    invoices.forEach((inv) => invoicesByTxId.set(inv.transaction_id, inv.id));
  }

  return transactions
    .filter((t) => t.type === "subscription_payment" || t.type === "coin_purchase")
    .map((t) => ({
      id: t.id,
      type: t.type as TransactionType,
      description: t.type === "coin_purchase" ? `${DESCRIPTIONS[t.type]} (${t.coins} credits)` : DESCRIPTIONS[t.type],
      amountInr: t.amount_inr ?? 0,
      status: t.status,
      occurredAt: t.created_at,
      invoiceId: invoicesByTxId.get(t.id) ?? null,
    }));
}
