import { LucideIcon } from "lucide-react";

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
