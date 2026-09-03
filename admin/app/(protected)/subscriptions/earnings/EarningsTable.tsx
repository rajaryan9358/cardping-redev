"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../../components/ui/Table";
import { Pagination } from "../../../../components/ui/Pagination";
import { TextField } from "../../../../components/ui/TextField";
import { Button } from "../../../../components/ui/Button";
import { Badge } from "../../../../components/ui/Badge";
import { FilterPopover, FilterOption } from "../../../../components/ui/FilterPopover";
import { EarningTransactionRow, EarningType } from "../../../../lib/repositories/adminSubscriptions.repo";
import { formatDateTime } from "../../../../lib/format";

const TYPE_OPTIONS: { value: EarningType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "subscription_payment", label: "Subscriptions" },
  { value: "coin_purchase", label: "Top-ups" },
];

export function EarningsTable({
  rows,
  total,
  sumInr,
  page,
  pageSize,
  type,
  from,
  to,
}: {
  rows: EarningTransactionRow[];
  total: number;
  sumInr: number;
  page: number;
  pageSize: number;
  type: string;
  from: string;
  to: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; pageSize?: number; type?: string; from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.type !== undefined) {
      next.type ? params.set("type", next.type) : params.delete("type");
      params.set("page", "1");
    }
    if (next.from !== undefined) {
      next.from ? params.set("from", next.from) : params.delete("from");
      params.set("page", "1");
    }
    if (next.to !== undefined) {
      next.to ? params.set("to", next.to) : params.delete("to");
      params.set("page", "1");
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    // Hard navigation, not router.push — same rationale as every other
    // filtered admin table (see NotificationLogTable's identical comment).
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  const typeValue = type ? TYPE_OPTIONS.find((o) => o.value === type)?.label ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <span className="mb-2 text-xs font-semibold tracking-wide text-muted-2">Filters:</span>
          <FilterPopover label="Type" value={typeValue} onClear={() => navigate({ type: "" })}>
            <div className="flex flex-col gap-1">
              {TYPE_OPTIONS.map((opt) => (
                <FilterOption key={opt.value} label={opt.label} selected={type === opt.value} onClick={() => navigate({ type: opt.value })} />
              ))}
            </div>
          </FilterPopover>
          <div className="w-36">
            <TextField label="From" type="date" value={from} onChange={(e) => navigate({ from: e.target.value })} />
          </div>
          <div className="w-36">
            <TextField label="To" type="date" value={to} onChange={(e) => navigate({ to: e.target.value })} />
          </div>
          {(type || from || to) && (
            <button
              type="button"
              onClick={() => navigate({ type: "", from: "", to: "" })}
              className="mb-2 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Total for this view</span>
            <span className="text-xl font-semibold text-ink tabular-nums">₹{sumInr.toLocaleString("en-US")}</span>
          </div>
          <a href={`/admin/subscriptions/earnings/export?${searchParams.toString()}`}>
            <Button variant="secondary" className="gap-1.5">
              <Download className="size-4" strokeWidth={2} />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>Date</Th>
          <Th>Paid by</Th>
          <Th>Type</Th>
          <Th align="right">Amount</Th>
          <Th align="right">Account</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No earnings in this range.</p>}
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
            <Td>
              <div className="font-medium text-ink">{row.full_name || "Unnamed"}</div>
              <div className="text-xs text-muted">{row.email || "—"}</div>
            </Td>
            <Td>
              <Badge tone={row.type === "subscription_payment" ? "success" : "pending"}>
                {row.type === "subscription_payment" ? "Subscription" : "Top-up"}
              </Badge>
            </Td>
            <Td align="right" className="tabular-nums">
              ₹{row.amount_inr.toLocaleString("en-US")}
            </Td>
            <Td align="right">
              {row.detail_user_id ? (
                <Link href={`/users/${row.detail_user_id}`} className="text-xs font-medium text-accent-text hover:underline">
                  View account
                </Link>
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
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
