import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SuccessCheck } from "@/components/ui/SuccessCheck";

// Same reasoning as ../success/page.tsx — Cashfree's return redirect
// carries no per-transaction data, so this can't claim a specific coin
// amount until the webhook actually credits it.
export default function TopUpSuccessPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center shadow-soft animate-fade-up">
      <SuccessCheck />
      <h1 className="text-2xl font-semibold text-ink">Payment received</h1>
      <p className="text-sm text-muted">We&apos;re confirming it now — your credits will land in your balance within a minute or two.</p>

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
