import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

/** Shared "vs last week" trend chip — pass a *TrendPct from home.route.ts
 * (null when there's no prior-period data to compare against, e.g. a
 * brand-new account). */
export function TrendIndicator({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-sm ${pct >= 0 ? "text-success-text" : "text-danger-text"}`}>
      <Icon className="size-3.5" strokeWidth={2.25} />
      {pct >= 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  trend?: React.ReactNode;
}

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="flex h-32 flex-1 flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon className="size-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</span>
        {trend}
      </div>
    </div>
  );
}
