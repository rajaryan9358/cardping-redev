"use client";

import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Account, Plan } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const ERROR_MESSAGES: Record<string, string> = {
  billing_not_configured: "Payments aren't set up yet — check back soon.",
  plan_not_found: "That plan is no longer available.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Couldn't start checkout. Please try again.";
}

export function QuickSubscribeClient({ account, plans }: { account: Account; plans: Plan[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: Plan) {
    setSelectedId(plan.id);
    setError(null);
    try {
      const res = await clientFetch("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      const { paymentLinkUrl } = await parseJsonOrThrow<{ paymentLinkUrl: string }>(res);
      window.location.href = paymentLinkUrl;
    } catch (err) {
      setError(errorMessage((err as Error).message));
      setSelectedId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Sparkles className="size-6" strokeWidth={2} />
        </span>
        <h1 className="text-xl font-semibold text-ink">Subscribe to a Plan</h1>
        <p className="text-sm text-muted">Recurring coins every billing cycle instead of one-off top-ups.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <div className="flex flex-col gap-3">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => subscribe(plan)}
            disabled={selectedId !== null || plan.isCurrent}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left shadow-soft transition-colors hover:border-accent disabled:opacity-50"
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {plan.name}
                {plan.isCurrent && <Check className="size-3.5 text-success-text" strokeWidth={2} />}
              </p>
              <p className="text-xs text-muted">
                ₹{plan.priceInr} / {plan.periodDays} days · {plan.coinsIncluded} coins
              </p>
            </div>
            <span className="text-xs font-medium text-accent">
              {plan.isCurrent ? "Current" : selectedId === plan.id ? "Redirecting…" : "Choose"}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        You have {account.coinBalance} coins available right now regardless of plan.
      </p>
    </div>
  );
}
