import { AlertCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PlanStatus } from "@/lib/planStatus";

/** Shown on Home and Subscription whenever the plan itself needs
 * attention — trial coins running out, or an expired/missing plan.
 * Separate from LowBalanceCard, which is about the coin balance and can
 * fire independently of plan state. */
export function PlanStatusCard({ status, coinBalance }: { status: PlanStatus; coinBalance: number }) {
  if (status.tone === "trial") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warning-border/50 bg-warning-bg px-6 py-5 shadow-soft animate-fade-up">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-border/20 text-warning-text">
            <AlertTriangle className="size-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-warning-text">You&apos;re on a free trial</p>
            <p className="text-xs text-warning-text/80">
              {coinBalance.toLocaleString()} trial coins remaining. Subscribe to a plan before they run out.
            </p>
          </div>
        </div>
        <Link href="/subscription" className="shrink-0">
          <Button className="px-4 py-2">View Plans</Button>
        </Link>
      </div>
    );
  }

  if (status.tone === "inactive") {
    const expired = status.label.includes("expired");
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-danger-bg bg-danger-bg px-6 py-5 shadow-soft animate-fade-up">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-text/10 text-danger-text">
            <AlertCircle className="size-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-danger-text">
              {expired ? "Your plan has expired" : "You don't have an active plan"}
            </p>
            <p className="text-xs text-danger-text/80">Renew now to keep capturing and managing leads without interruption.</p>
          </div>
        </div>
        <Link href="/subscription" className="shrink-0">
          <Button variant="dangerSolid" className="px-4 py-2">Renew Plan</Button>
        </Link>
      </div>
    );
  }

  return null;
}
