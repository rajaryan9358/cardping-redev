import { Coins } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const LOW_BALANCE_THRESHOLD = 100;

export function LowBalanceCard({ coinBalance }: { coinBalance: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warning-border/50 bg-warning-bg px-6 py-5 shadow-soft animate-fade-up">
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-border/20 text-warning-text">
          <Coins className="size-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-sm font-semibold text-warning-text">Your credit balance is running low</p>
          <p className="text-xs text-warning-text/80">
            Only <span className="font-semibold">{coinBalance.toLocaleString()} credits</span> left. Top up now to keep
            capturing leads without interruption.
          </p>
        </div>
      </div>
      <Link href="/subscription/topup" className="shrink-0">
        <Button className="px-4 py-2">Top Up Credits</Button>
      </Link>
    </div>
  );
}
