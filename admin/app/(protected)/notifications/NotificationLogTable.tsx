"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { NotificationLogRow } from "../../../lib/repositories/adminNotifications.repo";
import { formatDateTime } from "../../../lib/format";

const STATUS_TONE = { sent: "success", failed: "danger", pending: "pending" } as const;

export function NotificationLogTable({
  rows,
  total,
  page,
  pageSize,
  type,
  triggeredBy,
}: {
  rows: NotificationLogRow[];
  total: number;
  page: number;
  pageSize: number;
  type: string;
  triggeredBy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; type?: string; triggeredBy?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.type !== undefined) {
      next.type ? params.set("type", next.type) : params.delete("type");
      params.set("page", "1");
    }
    if (next.triggeredBy !== undefined) {
      next.triggeredBy ? params.set("triggeredBy", next.triggeredBy) : params.delete("triggeredBy");
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => navigate({ type: e.target.value })}
          className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
        >
          <option value="">All types</option>
          <option value="renewal_reminder">Renewal reminder</option>
          <option value="low_balance_alert">Low balance alert</option>
        </select>
        <select
          value={triggeredBy}
          onChange={(e) => navigate({ triggeredBy: e.target.value })}
          className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
        >
          <option value="">Auto & manual</option>
          <option value="auto">Auto only</option>
          <option value="manual">Manual only</option>
        </select>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>When</Th>
          <Th>User</Th>
          <Th>Type</Th>
          <Th>Triggered by</Th>
          <Th>Status</Th>
          <Th>Error</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No notifications yet.</p>}
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
            <Td>{row.user?.full_name || row.user?.email || "—"}</Td>
            <Td className="capitalize">{row.type.replace(/_/g, " ")}</Td>
            <Td>{row.triggered_by === "manual" ? row.admin?.email || "Manual" : "Auto"}</Td>
            <Td>
              <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
            </Td>
            <Td className="max-w-xs truncate text-xs">{row.error || "—"}</Td>
          </Tr>
        ))}
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / pageSize))}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={(p) => navigate({ page: p })}
        />
      </TableCard>
    </div>
  );
}
