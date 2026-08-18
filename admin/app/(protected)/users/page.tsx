import { adminUsersRepo, UserStatusFilter } from "../../../lib/repositories/adminUsers.repo";
import { adminSubscriptionsRepo } from "../../../lib/repositories/adminSubscriptions.repo";
import { UsersTable } from "./UsersTable";

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
    expiresBefore?: string;
    expiresAfter?: string;
    sort?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const search = searchParams.search ?? "";
  const status = (searchParams.status || undefined) as UserStatusFilter | undefined;
  const expiresBefore = searchParams.expiresBefore || undefined;
  const expiresAfter = searchParams.expiresAfter || undefined;
  const sort = searchParams.sort || undefined;
  const [{ rows, total }, plans] = await Promise.all([
    adminUsersRepo.listUsers({ search, status, expiresBefore, expiresAfter, sort, page, pageSize: PAGE_SIZE }),
    adminSubscriptionsRepo.listPlans(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">{total} total</p>
      </div>
      <UsersTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        search={search}
        status={status ?? ""}
        expiresBefore={expiresBefore ?? ""}
        expiresAfter={expiresAfter ?? ""}
        sort={sort ?? ""}
        plans={plans}
      />
    </div>
  );
}
