import { adminSubscriptionsRepo } from "../../../lib/repositories/adminSubscriptions.repo";
import { Tabs } from "../../../components/ui/Tabs";
import { EarningsStatCard } from "./EarningsStatCard";
import { SubscribedUsersTable } from "./SubscribedUsersTable";
import { PlansManager } from "./PlansManager";
import { TopUpsManager } from "./TopUpsManager";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const [summary, { rows, total }, plans, allPlans, topUps] = await Promise.all([
    adminSubscriptionsRepo.getSubscriptionSummary(),
    adminSubscriptionsRepo.listSubscribedUsers(page, pageSize),
    adminSubscriptionsRepo.listPlans(),
    adminSubscriptionsRepo.listAllPlans(),
    adminSubscriptionsRepo.listAllTopUps(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">Plans, top-ups, and subscribers.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total subscribed" value={String(summary.totalSubscribed)} />
        <StatCard label="Active" value={String(summary.active)} />
        <StatCard label="Expired" value={String(summary.expired)} />
        <EarningsStatCard value={`₹${summary.totalEarningInr.toLocaleString("en-US")}`} />
      </section>

      <Tabs
        tabs={[
          {
            id: "users",
            label: "Subscribed users",
            content: <SubscribedUsersTable rows={rows} plans={plans} total={total} page={page} pageSize={pageSize} />,
          },
          { id: "plans", label: "Plans", content: <PlansManager plans={allPlans} /> },
          { id: "topups", label: "Top-ups", content: <TopUpsManager topUps={topUps} /> },
        ]}
      />
    </div>
  );
}
