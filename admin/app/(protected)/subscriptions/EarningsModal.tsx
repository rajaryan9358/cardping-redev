"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { Button } from "../../../components/ui/Button";
import { cn } from "@/lib/cn";
import { EarningTransactionRow, EarningType } from "../../../lib/repositories/adminSubscriptions.repo";
import { formatDateTime } from "../../../lib/format";
import { getEarningTransactionsAction } from "./actions";

const TABS: { value: EarningType; label: string }[] = [
  { value: "subscription_payment", label: "Subscriptions" },
  { value: "coin_purchase", label: "Top-ups" },
];

const PAGE_SIZE = 20;

export function EarningsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<EarningType>("subscription_payment");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ rows: EarningTransactionRow[]; total: number; sumInr: number }>({
    rows: [],
    total: 0,
    sumInr: 0,
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getEarningTransactionsAction({ type: tab, from: from || undefined, to: to || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [open, tab, from, to, page]);

  function switchTab(next: EarningType) {
    setTab(next);
    setPage(1);
  }

  function applyDateFilter(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setPage(1);
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Total Earning" className="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-xl border border-border bg-surface-warm p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => switchTab(t.value)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <TextField label="From" type="date" value={from} onChange={(e) => applyDateFilter(e.target.value, to)} />
          </div>
          <div className="w-40">
            <TextField label="To" type="date" value={to} onChange={(e) => applyDateFilter(from, e.target.value)} />
          </div>
          {(from || to) && (
            <Button variant="secondary" onClick={() => applyDateFilter("", "")}>
              Clear
            </Button>
          )}
          <div className="ml-auto flex flex-col items-end">
            <span className="text-xs text-muted">Total for this view</span>
            <span className="text-xl font-semibold text-ink tabular-nums">₹{result.sumInr.toLocaleString("en-US")}</span>
          </div>
        </div>

        <TableCard className="border-0 shadow-none">
          <TableHeaderRow>
            <Th>Date</Th>
            <Th>Paid by</Th>
            <Th align="right">Amount</Th>
          </TableHeaderRow>
          {!loading && result.rows.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-muted">No {TABS.find((t) => t.value === tab)?.label.toLowerCase()} in this range.</p>
          )}
          {loading && <p className="px-6 py-10 text-center text-sm text-muted">Loading…</p>}
          {!loading &&
            result.rows.map((row) => (
              <Tr key={row.id}>
                <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
                <Td>{row.full_name || row.email || "—"}</Td>
                <Td align="right" className="tabular-nums">
                  ₹{row.amount_inr.toLocaleString("en-US")}
                </Td>
              </Tr>
            ))}
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(result.total / PAGE_SIZE))}
            totalItems={result.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </TableCard>
      </div>
    </Modal>
  );
}
