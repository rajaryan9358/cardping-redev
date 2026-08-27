"use client";

import { Check, Coins, CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LowBalanceCard, LOW_BALANCE_THRESHOLD } from "@/components/ui/LowBalanceCard";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { getPlanStatus } from "@/lib/planStatus";
import { Account, Plan } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const ERROR_MESSAGES: Record<string, string> = {
  billing_not_configured: "Payments aren't set up yet — check back soon.",
  plan_not_found: "That plan is no longer available.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Couldn't start checkout. Please try again.";
}

function planDescription(name: string): string {
  if (name === "Starter") return "Essential tools for individuals and small setups.";
  if (name === "Professional") return "Advanced features for growing teams and agencies.";
  return "Custom solutions for large scale operations.";
}

function annualSavingsPct(monthly: number, annual: number): number {
  const fullYearAtMonthlyRate = monthly * 12;
  if (fullYearAtMonthlyRate <= 0) return 0;
  return Math.round(((fullYearAtMonthlyRate - annual) / fullYearAtMonthlyRate) * 100);
}

export function SubscriptionClient({ account, plans }: { account: Account; plans: Plan[] }) {
  const coinBalance = account.coinBalance;
  const currentPlan = plans.find((p) => p.id === account.planId);
  const status = getPlanStatus({ ...account, coinBalance }, plans);
  const lowBalance = coinBalance <= LOW_BALANCE_THRESHOLD;

  // Annual by default — matches the discount being the more prominent,
  // recommended choice on the pricing cards below.
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  const [pendingPlan, setPendingPlan] = useState<{ plan: Plan; billingPeriod: "monthly" | "annual" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmPlanSwitch() {
    if (!pendingPlan) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await clientFetch("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId: pendingPlan.plan.id, billingPeriod: pendingPlan.billingPeriod }),
      });
      const { paymentLinkUrl } = await parseJsonOrThrow<{ paymentLinkUrl: string }>(res);
      // Cashfree's hosted checkout — payment confirmation comes back via
      // webhook, not this redirect (see server/src/routes/cashfreeWebhook.route.ts).
      window.location.href = paymentLinkUrl;
    } catch (err) {
      setError(errorMessage((err as Error).message));
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Subscription Management</h1>
          <p className="text-sm text-muted">Manage your plan, billing cycle, and credit balance.</p>
        </div>
        <Link href="/subscription/topup">
          <Button variant="secondary" className="gap-2">
            <Coins className="size-4" strokeWidth={2} /> Top Up Credits
          </Button>
        </Link>
      </div>

      {lowBalance && <LowBalanceCard coinBalance={coinBalance} />}

      {status.tone === "active" && currentPlan && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <CreditCard className="size-3.5" strokeWidth={2} /> Current Plan
            </span>
            <p className="pt-1 text-xl font-semibold text-ink">
              {currentPlan.name}{" "}
              <span className="text-sm font-normal text-muted">
                / ₹
                {(account.planBillingPeriod === "annual" && currentPlan.annualPriceInr !== null
                  ? currentPlan.annualPriceInr
                  : currentPlan.priceInr
                ).toLocaleString()}{" "}
                per {account.planBillingPeriod === "annual" ? "year" : "month"}
              </span>
            </p>
            {account.planExpiresAt && (
              <p className="pt-1 text-sm text-muted">
                Next billing date: {new Date(account.planExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2">
            <Coins className="size-4 text-accent" strokeWidth={2} />
            <span className="text-sm font-semibold text-accent-text">{coinBalance.toLocaleString()} credits</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm font-medium", billingPeriod === "monthly" ? "text-ink" : "text-muted")}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={billingPeriod === "annual"}
          onClick={() => setBillingPeriod((v) => (v === "annual" ? "monthly" : "annual"))}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", billingPeriod === "annual" ? "bg-accent" : "bg-border")}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform",
              billingPeriod === "annual" ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
        <span className={cn("text-sm font-medium", billingPeriod === "annual" ? "text-ink" : "text-muted")}>
          Annual <span className="text-accent-text">(best value)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === account.planId;
          // Falls back to monthly for any plan with no annual price
          // configured yet, rather than showing a blank/broken card.
          const effectivePeriod = billingPeriod === "annual" && plan.annualPriceInr !== null ? "annual" : "monthly";
          const displayPrice = effectivePeriod === "annual" ? plan.annualPriceInr! : plan.priceInr;
          const savingsPct =
            effectivePeriod === "annual" ? annualSavingsPct(plan.priceInr, plan.annualPriceInr!) : 0;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col gap-4 rounded-xl border bg-surface p-6 shadow-soft",
                isCurrent ? "border-2 border-accent" : "border-border",
              )}
            >
              {isCurrent && (
                <span className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <Sparkles className="size-3" strokeWidth={2.5} /> Current
                </span>
              )}
              <div>
                <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
                <p className="pt-1 text-sm text-muted">{planDescription(plan.name)}</p>
              </div>
              <div className="text-3xl font-semibold text-ink">
                ₹{displayPrice.toLocaleString()}
                <span className="text-sm font-normal text-muted">{effectivePeriod === "annual" ? "/yr" : "/mo"}</span>
              </div>
              {billingPeriod === "annual" && effectivePeriod === "annual" && savingsPct > 0 && (
                <span className="w-fit rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success-text">
                  Save {savingsPct}% vs monthly
                </span>
              )}
              {billingPeriod === "annual" && effectivePeriod === "monthly" && (
                <span className="text-xs text-muted">Annual billing not available for this plan yet</span>
              )}
              <ul className="flex flex-col gap-2 text-sm text-ink">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success-text" strokeWidth={2.5} /> {plan.coinsIncluded.toLocaleString()} Credits / month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success-text" strokeWidth={2.5} />
                  {plan.name === "Enterprise" ? "Unlimited" : plan.name === "Professional" ? "Up to 5" : "1"} Team Member
                  {plan.name !== "Starter" && "s"}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success-text" strokeWidth={2.5} /> {plan.name === "Starter" ? "Basic" : "Advanced"} Lead Export
                </li>
                {plan.name !== "Starter" && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success-text" strokeWidth={2.5} /> One-click CRM Sync
                  </li>
                )}
              </ul>
              <Button
                variant={isCurrent ? "secondary" : "primary"}
                disabled={isCurrent}
                className="mt-auto w-full"
                onClick={() => setPendingPlan({ plan, billingPeriod: effectivePeriod })}
              >
                {isCurrent
                  ? "Active Plan"
                  : plan.priceInr < (currentPlan?.priceInr ?? 0)
                    ? `Downgrade to ${plan.name}`
                    : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!pendingPlan}
        onClose={() => !confirming && setPendingPlan(null)}
        title={pendingPlan ? `Switch to ${pendingPlan.plan.name}?` : ""}
        footer={
          <>
            <Button variant="secondary" disabled={confirming} onClick={() => setPendingPlan(null)}>
              Cancel
            </Button>
            <Button loading={confirming} onClick={confirmPlanSwitch}>
              {confirming
                ? "Processing..."
                : `Confirm & Pay ₹${(pendingPlan?.billingPeriod === "annual" ? pendingPlan.plan.annualPriceInr! : pendingPlan?.plan.priceInr ?? 0).toLocaleString()}`}
            </Button>
          </>
        }
      >
        {pendingPlan && (
          <div className="flex flex-col gap-3">
            {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}
            <p className="text-sm text-muted">
              You&apos;ll be redirected to a secure payment page to pay ₹
              {(pendingPlan.billingPeriod === "annual" ? pendingPlan.plan.annualPriceInr! : pendingPlan.plan.priceInr).toLocaleString()}{" "}
              billed {pendingPlan.billingPeriod}, and your credit allotment will change to{" "}
              {pendingPlan.plan.coinsIncluded.toLocaleString()} credits per billing cycle.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
