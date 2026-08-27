import { adminAuditLogRepo } from "../../../lib/repositories/adminAuditLog.repo";
import { AuditLogTable } from "./AuditLogTable";

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 30;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; action?: string; adminUserId?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const action = searchParams.action ?? "";
  const adminUserId = searchParams.adminUserId ?? "";

  const [{ rows, total }, actions, admins] = await Promise.all([
    adminAuditLogRepo.listAuditLog({
      page,
      pageSize,
      action: action || undefined,
      adminUserId: adminUserId || undefined,
    }),
    adminAuditLogRepo.listDistinctActions(),
    adminAuditLogRepo.listAdminUsers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">{total} entries, newest first</p>
      </div>
      <AuditLogTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        actions={actions}
        admins={admins}
        selectedAction={action}
        selectedAdminId={adminUserId}
      />
    </div>
  );
}
