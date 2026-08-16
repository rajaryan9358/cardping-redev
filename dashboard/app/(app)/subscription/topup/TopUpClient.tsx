"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { Account } from "@/lib/types";
import { TopUpPackage } from "@/lib/mock/topups";

export function TopUpClient({ account, topUps }: { account: Account; topUps: TopUpPackage[] }) {
  const router = useRouter();
  const coinBalance = account.coinBalance;
  const [pendingTopUp, setPendingTopUp] = useState<TopUpPackage | null>(null);
  const [paying, setPaying] = useState(false);

  function confirmTopUp() {
    if (!pendingTopUp) return;
    setPaying(true);
    const newBalance = coinBalance + pendingTopUp.coins;
    setTimeout(() => {
      router.push(`/subscription/topup/success?coins=${pendingTopUp.coins}&price=${pendingTopUp.priceInr}&balance=${newBalance}`);
    }, 900);
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

      <div className="grid grid-cols-4 gap-4">
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
          <p className="text-sm text-muted">
            You&apos;ll be charged ₹{pendingTopUp.priceInr.toLocaleString()} and {pendingTopUp.coins.toLocaleString()} coins will be added to
            your balance immediately.
          </p>
        )}
      </Modal>
    </div>
  );
}
