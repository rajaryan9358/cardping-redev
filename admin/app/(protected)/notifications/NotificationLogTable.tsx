"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { FilterPopover, FilterOption } from "../../../components/ui/FilterPopover";
import { NotificationLogRow } from "../../../lib/repositories/adminNotifications.repo";
import { formatDateTime } from "../../../lib/format";

const STATUS_TONE = { sent: "success", failed: "danger", pending: "pending" } as const;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "renewal_reminder", label: "Renewal reminder" },
  { value: "low_balance_alert", label: "Low balance alert" },
] as const;

const TRIGGERED_BY_OPTIONS = [
  { value: "", label: "Auto & manual" },
  { value: "auto", label: "Auto only" },
  { value: "manual", label: "Manual only" },
] as const;

// Send failures get thrown (and persisted) as one flattened string, e.g.
// `WhatsApp send failed (404): {"error":{"message":"..."}}` — this pulls
// out a short human summary for the visible cell; the raw string stays
// available as a hover tooltip instead of a truncated JSON blob.
const SEND_FAILURE_PATTERN = /^(\w+) send failed \((\d+)\):/;

function formatNotificationError(raw: string | null): { summary: string; title?: string } {
  if (!raw) return { summary: "—" };
  const match = raw.match(SEND_FAILURE_PATTERN);
  if (match) return { summary: `${match[1]} delivery failed — HTTP ${match[2]}`, title: raw };
  return { summary: raw, title: raw };
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; pageSize?: number; type?: string; triggeredBy?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.type !== undefined) {
      next.type ? params.set("type", next.type) : params.delete("type");
      params.set("page", "1");
    }
    if (next.triggeredBy !== undefined) {
      next.triggeredBy ? params.set("triggeredBy", next.triggeredBy) : params.delete("triggeredBy");
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

  const typeValue = type ? TYPE_OPTIONS.find((o) => o.value === type)?.label ?? null : null;
  const triggeredByValue = triggeredBy ? TRIGGERED_BY_OPTIONS.find((o) => o.value === triggeredBy)?.label ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-2">Filters:</span>

        <FilterPopover label="Type" value={typeValue} onClear={() => navigate({ type: "" })}>
          <div className="flex flex-col gap-1">
            {TYPE_OPTIONS.map((opt) => (
              <FilterOption key={opt.value} label={opt.label} selected={type === opt.value} onClick={() => navigate({ type: opt.value })} />
            ))}
          </div>
        </FilterPopover>

        <FilterPopover label="Triggered by" value={triggeredByValue} onClear={() => navigate({ triggeredBy: "" })}>
          <div className="flex flex-col gap-1">
            {TRIGGERED_BY_OPTIONS.map((opt) => (
              <FilterOption
                key={opt.value}
                label={opt.label}
                selected={triggeredBy === opt.value}
                onClick={() => navigate({ triggeredBy: opt.value })}
              />
            ))}
          </div>
        </FilterPopover>
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
            <Td className="max-w-xs truncate text-xs">
              <span title={formatNotificationError(row.error).title}>{formatNotificationError(row.error).summary}</span>
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
