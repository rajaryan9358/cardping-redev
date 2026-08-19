import { adminSubscriptionsRepo } from "../../../lib/repositories/adminSubscriptions.repo";
import { Tabs } from "../../../components/ui/Tabs";
import { SubscribedUsersTable } from "./SubscribedUsersTable";
import { SubscribedAccountsTable } from "./SubscribedAccountsTable";
import { PlansManager } from "./PlansManager";
import { TopUpsManager } from "./TopUpsManager";

const PAGE_SIZE = 20;

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
  searchParams: { page?: string; accountsPage?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const accountsPage = Math.max(1, Number(searchParams.accountsPage) || 1);
  const [summary, { rows, total }, accountRows, plans, allPlans, topUps] = await Promise.all([
    adminSubscriptionsRepo.getSubscriptionSummary(),
    adminSubscriptionsRepo.listSubscribedUsers(page, PAGE_SIZE),
    adminSubscriptionsRepo.listSubscribedAccounts(accountsPage, PAGE_SIZE),
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
        <StatCard label="Total earning" value={`₹${summary.totalEarningInr.toLocaleString("en-US")}`} />
      </section>

      <Tabs
        tabs={[
          {
            id: "users",
            label: "Subscribed users",
            content: <SubscribedUsersTable rows={rows} plans={plans} total={total} page={page} pageSize={PAGE_SIZE} />,
          },
          {
            id: "accounts",
            label: "Subscribed accounts",
            content: (
              <SubscribedAccountsTable
                rows={accountRows.rows}
                plans={plans}
                total={accountRows.total}
                page={accountsPage}
                pageSize={PAGE_SIZE}
              />
            ),
          },
          { id: "plans", label: "Plans", content: <PlansManager plans={allPlans} /> },
          { id: "topups", label: "Top-ups", content: <TopUpsManager topUps={topUps} /> },
        ]}
      />
    </div>
  );
}
