import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SuccessCheck } from "@/components/ui/SuccessCheck";

// Cashfree's hosted checkout redirects here after payment — but only ever
// to this one static URL (no per-transaction query params), and payment
// confirmation itself arrives separately via webhook (see
// server/src/routes/cashfreeWebhook.route.ts), which may not have landed
// yet by the time the browser gets here. So this stays a generic
// "we're on it" page rather than claiming a specific plan/price it can't
// actually confirm yet.
export default function SubscriptionSuccessPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center shadow-soft animate-fade-up">
      <SuccessCheck />
      <h1 className="text-2xl font-semibold text-ink">Payment received</h1>
      <p className="text-sm text-muted">
        We&apos;re confirming it now — your plan and credit balance will update within a minute or two.
      </p>

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
    </div>
  );
}
