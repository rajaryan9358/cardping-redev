"use client";

import { Coins } from "lucide-react";
import { useState } from "react";
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

export function QuickTopUpClient({ account, topUps }: { account: Account; topUps: TopUpPackage[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(pkg: TopUpPackage) {
    setSelectedId(pkg.id);
    setError(null);
    try {
      const res = await clientFetch("/api/billing/coins/topup", {
        method: "POST",
        body: JSON.stringify({ topupPackageId: pkg.id }),
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
          <Coins className="size-6" strokeWidth={2} />
        </span>
        <h1 className="text-xl font-semibold text-ink">Buy Credits</h1>
        <p className="text-sm text-muted">You have {account.coinBalance} coins. Pick a top-up to add more.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <div className="flex flex-col gap-3">
        {topUps.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => buy(pkg)}
            disabled={selectedId !== null}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left shadow-soft transition-colors hover:border-accent disabled:opacity-50"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{pkg.coins} coins</p>
              <p className="text-xs text-muted">₹{pkg.priceInr}</p>
            </div>
            <span className="text-xs font-medium text-accent">{selectedId === pkg.id ? "Redirecting…" : "Buy"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
