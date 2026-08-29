"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { FilterPopover, FilterOption } from "../../../components/ui/FilterPopover";
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

  function navigate(next: { page?: number; pageSize?: number; action?: string; adminUserId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.action !== undefined) {
      next.action ? params.set("action", next.action) : params.delete("action");
      params.set("page", "1");
    }
    if (next.adminUserId !== undefined) {
      next.adminUserId ? params.set("adminUserId", next.adminUserId) : params.delete("adminUserId");
      params.set("page", "1");
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    // Hard navigation, not router.push: a soft nav to a URL visited earlier
    // this session would instantly repaint whatever Next's client Router
    // Cache last had for it — stale rows included — before router.refresh()
    // gets a chance to correct it a moment later.
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  const actionValue = selectedAction || null;
  const adminValue = selectedAdminId ? admins.find((a) => a.id === selectedAdminId)?.email ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-2">Filters:</span>

        <FilterPopover label="Action" value={actionValue} onClear={() => navigate({ action: "" })}>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            <FilterOption label="All actions" selected={!selectedAction} onClick={() => navigate({ action: "" })} />
            {actions.map((a) => (
              <FilterOption key={a} label={a} selected={selectedAction === a} onClick={() => navigate({ action: a })} />
            ))}
          </div>
        </FilterPopover>

        <FilterPopover label="Admin" value={adminValue} onClear={() => navigate({ adminUserId: "" })}>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            <FilterOption label="All admins" selected={!selectedAdminId} onClick={() => navigate({ adminUserId: "" })} />
            {admins.map((a) => (
              <FilterOption key={a.id} label={a.email} selected={selectedAdminId === a.id} onClick={() => navigate({ adminUserId: a.id })} />
            ))}
          </div>
        </FilterPopover>
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
          onPageSizeChange={(size) => navigate({ pageSize: size })}
        />
      </TableCard>
    </div>
  );
}
