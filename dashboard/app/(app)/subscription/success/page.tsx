"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SuccessCheck } from "@/components/ui/SuccessCheck";

const REDIRECT_MS = 5000;

function SubscriptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planName = searchParams.get("plan") ?? "your plan";
  const price = Number(searchParams.get("price") ?? 0);
  const coins = Number(searchParams.get("coins") ?? 0);

  useEffect(() => {
    const timer = setTimeout(() => router.push("/subscription"), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center shadow-soft animate-fade-up">
      <SuccessCheck />
      <h1 className="text-2xl font-semibold text-ink">You&apos;re on {planName}!</h1>
      <p className="text-sm text-muted">
        Your subscription is active. ₹{price.toLocaleString()}/mo, with {coins.toLocaleString()} coins refreshed every billing
        cycle.
      </p>

      <div className="flex items-center gap-2 rounded-full bg-accent-soft px-5 py-2.5">
        <Coins className="size-4 text-accent" strokeWidth={2} />
        <span className="text-sm font-semibold text-accent-text">{coins.toLocaleString()} coins / cycle</span>
      </div>

      <div className="flex w-full gap-3 pt-2">
        <Link href="/home" className="flex-1">
          <Button variant="secondary" className="w-full">
            Go to Home
          </Button>
        </Link>
        <Link href="/subscription" className="flex-1">
          <Button className="w-full">View Subscription</Button>
        </Link>
      </div>

      <p className="text-xs text-muted">Redirecting to Subscription automatically…</p>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense>
      <SubscriptionSuccessContent />
    </Suspense>
  );
}
