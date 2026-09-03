import Link from "next/link";

export function EarningsStatCard({ value }: { value: string }) {
  return (
    <Link
      href="/subscriptions/earnings"
      className="rounded-xl border border-border bg-surface p-6 text-left shadow-soft transition-colors hover:border-accent"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total earning</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </Link>
  );
}
