import { Calendar, ScanLine, Users } from "lucide-react";
import Link from "next/link";
import { StatCard, TrendIndicator } from "@/components/ui/StatCard";
import { LowBalanceCard, LOW_BALANCE_THRESHOLD } from "@/components/ui/LowBalanceCard";
import { PlanStatusCard } from "@/components/ui/PlanStatusCard";
import { ScansExplorer } from "@/components/scans/ScansExplorer";
import { getCurrentAccount } from "@/lib/data/account";
import { allTags, getRecentCards } from "@/lib/data/cards";
import { getEvents } from "@/lib/data/events";
import { getHomeSummary } from "@/lib/data/home";
import { getPlans } from "@/lib/data/billing";
import { getPlanStatus } from "@/lib/planStatus";

export default async function HomePage() {
  const account = await getCurrentAccount();
  const [recentCards, events, plans, summary] = await Promise.all([
    getRecentCards(10),
    getEvents(),
    getPlans(),
    getHomeSummary(),
  ]);
  const lowBalance = account.coinBalance <= LOW_BALANCE_THRESHOLD;
  const planStatus = getPlanStatus(account, plans);

  return (
    <div className="flex flex-col gap-8">
      {planStatus.tone !== "active" && <PlanStatusCard status={planStatus} coinBalance={account.coinBalance} />}
      {lowBalance && <LowBalanceCard coinBalance={account.coinBalance} />}

      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="text-sm text-muted">Overview of your lead generation activity.</p>
      </div>

      <div className="flex gap-4">
        <StatCard
          label="Total Contacts"
          value={summary.totalContacts}
          icon={Users}
          trend={<TrendIndicator pct={summary.contactsTrendPct} />}
        />
        <StatCard
          label="Total Events"
          value={summary.totalEvents}
          icon={Calendar}
          trend={<TrendIndicator pct={summary.eventsTrendPct} />}
        />
        <StatCard
          label="Scans This Week"
          value={summary.scansThisWeek}
          icon={ScanLine}
          trend={<TrendIndicator pct={summary.scansTrendPct} />}
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Recent Scans</h2>
        <Link href="/directory" className="text-xs font-semibold text-accent hover:text-accent-hover">
          View All →
        </Link>
      </div>
      <ScansExplorer
        initialCards={recentCards}
        events={events}
        allTags={allTags(recentCards)}
        showToolbar={false}
        showPagination={false}
        limit={6}
      />
    </div>
  );
}
