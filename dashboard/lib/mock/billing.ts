import { Plan, Transaction } from "../types";

export const mockPlans: Plan[] = [
  { id: "plan_starter", name: "Starter", priceInr: 999, annualPriceInr: 9990, periodDays: 30, coinsIncluded: 200, isCurrent: false },
  { id: "plan_professional", name: "Professional", priceInr: 2499, annualPriceInr: 24990, periodDays: 30, coinsIncluded: 750, isCurrent: true },
  { id: "plan_enterprise", name: "Enterprise", priceInr: 5999, annualPriceInr: 59990, periodDays: 30, coinsIncluded: 2000, isCurrent: false },
];

export const mockTransactions: Transaction[] = [
  {
    id: "txn_1",
    type: "coin_purchase",
    description: "Credit Top-Up — 500 Credits",
    amountInr: 4900,
    status: "completed",
    occurredAt: "2026-09-28",
    invoiceId: "inv_1",
  },
  {
    id: "txn_2",
    type: "subscription_payment",
    description: "Professional Plan Renewal",
    amountInr: 4900,
    status: "completed",
    occurredAt: "2026-09-15",
    invoiceId: "inv_2",
  },
  {
    id: "txn_3",
    type: "coin_purchase",
    description: "Premium Lead Reveal",
    amountInr: 0,
    status: "completed",
    occurredAt: "2026-09-20",
    invoiceId: null,
  },
  {
    id: "txn_4",
    type: "subscription_payment",
    description: "Professional Plan Renewal",
    amountInr: 4900,
    status: "completed",
    occurredAt: "2026-08-15",
    invoiceId: "inv_3",
  },
  {
    id: "txn_5",
    type: "coin_purchase",
    description: "Credit Top-Up — 1000 Credits",
    amountInr: 8900,
    status: "failed",
    occurredAt: "2026-07-25",
    invoiceId: null,
  },
];
