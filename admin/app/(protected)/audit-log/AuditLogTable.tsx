"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { AuditLogRow } from "../../../lib/repositories/adminAuditLog.repo";
import { formatDateTime } from "../../../lib/format";

export function AuditLogTable({
  rows,
  total,
  page,
  pageSize,
  actions,
  admins,
  selectedAction,
  selectedAdminId,
}: {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  actions: string[];
  admins: { id: string; email: string }[];
  selectedAction: string;
  selectedAdminId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; action?: string; adminUserId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.action !== undefined) {
      next.action ? params.set("action", next.action) : params.delete("action");
      params.set("page", "1");
    }
    if (next.adminUserId !== undefined) {
      next.adminUserId ? params.set("adminUserId", next.adminUserId) : params.delete("adminUserId");
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    // Hard navigation, not router.push: a soft nav to a URL visited earlier
    // this session would instantly repaint whatever Next's client Router
    // Cache last had for it — stale rows included — before router.refresh()
    // gets a chance to correct it a moment later.
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedAction}
          onChange={(e) => navigate({ action: e.target.value })}
          className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={selectedAdminId}
          onChange={(e) => navigate({ adminUserId: e.target.value })}
          className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
        >
          <option value="">All admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>When</Th>
          <Th>Admin</Th>
          <Th>Action</Th>
          <Th>Target</Th>
          <Th>Detail</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No entries.</p>}
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
            <Td>{row.admin?.email || "—"}</Td>
            <Td>{row.action}</Td>
            <Td className="truncate">
              {row.target_table ? `${row.target_table}${row.target_id ? ` / ${row.target_id}` : ""}` : "—"}
            </Td>
            <Td className="max-w-xs truncate font-mono text-xs">
              {Object.keys(row.detail).length > 0 ? JSON.stringify(row.detail) : "—"}
            </Td>
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
