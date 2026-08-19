"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { Account } from "@/lib/types";
import { TopUpPackage } from "@/lib/mock/topups";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const ERROR_MESSAGES: Record<string, string> = {
  billing_not_configured: "Payments aren't set up yet — check back soon.",
  package_not_found: "That package is no longer available.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Couldn't start checkout. Please try again.";
}

export function TopUpClient({ account, topUps }: { account: Account; topUps: TopUpPackage[] }) {
  const coinBalance = account.coinBalance;
  const [pendingTopUp, setPendingTopUp] = useState<TopUpPackage | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmTopUp() {
    if (!pendingTopUp) return;
    setPaying(true);
    setError(null);
    try {
      const res = await clientFetch("/api/billing/coins/topup", {
        method: "POST",
        body: JSON.stringify({ topupPackageId: pendingTopUp.id }),
      });
      const { paymentLinkUrl } = await parseJsonOrThrow<{ paymentLinkUrl: string }>(res);
      window.location.href = paymentLinkUrl;
    } catch (err) {
      setError(errorMessage((err as Error).message));
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/subscription" className="text-sm text-muted hover:text-ink">
          &larr; Subscription
        </Link>
        <h1 className="pt-1 text-[28px] font-semibold tracking-tight text-ink">Top Up Coins</h1>
        <p className="text-sm text-muted">Need more scans right now? Top up without changing your plan.</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-6 py-4 shadow-soft">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Coins className="size-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-xs text-muted">Current balance</p>
          <p className="text-lg font-semibold text-ink">{coinBalance.toLocaleString()} coins</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topUps.map((pkg) => (
          <div
            key={pkg.id}
            className={cn(
              "relative flex flex-col items-center gap-3 rounded-xl border bg-surface p-6 text-center shadow-soft",
              pkg.popular ? "border-2 border-accent" : "border-border",
            )}
          >
            {pkg.popular && (
              <span className="absolute -top-3 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                Best Value
              </span>
            )}
            <Coins className="size-6 text-accent" strokeWidth={1.75} />
            <div className="text-2xl font-semibold text-ink">{pkg.coins.toLocaleString()}</div>
            <div className="text-xs text-muted">coins</div>
            <div className="text-lg font-semibold text-ink">₹{pkg.priceInr.toLocaleString()}</div>
            <Button variant={pkg.popular ? "primary" : "secondary"} className="w-full" onClick={() => setPendingTopUp(pkg)}>
              Buy
            </Button>
          </div>
        ))}
      </div>

      <Modal
        open={!!pendingTopUp}
        onClose={() => !paying && setPendingTopUp(null)}
        title={pendingTopUp ? `Buy ${pendingTopUp.coins.toLocaleString()} coins` : ""}
        footer={
          <>
            <Button variant="secondary" disabled={paying} onClick={() => setPendingTopUp(null)}>
              Cancel
            </Button>
            <Button loading={paying} onClick={confirmTopUp}>
              {paying ? "Processing..." : `Pay ₹${pendingTopUp?.priceInr.toLocaleString()}`}
            </Button>
          </>
        }
      >
        {pendingTopUp && (
          <div className="flex flex-col gap-3">
            {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}
            <p className="text-sm text-muted">
              You&apos;ll be redirected to a secure payment page to pay ₹{pendingTopUp.priceInr.toLocaleString()}. Once
              paid, {pendingTopUp.coins.toLocaleString()} coins will be added to your balance.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
