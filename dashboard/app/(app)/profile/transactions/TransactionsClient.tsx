"use client";

import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { TableCard, TableHeaderRow, Th, Td, Tr } from "@/components/ui/Table";
import { Transaction } from "@/lib/types";

const STATUS_TONE = { completed: "success", pending: "pending", failed: "danger" } as const;
const STATUS_LABEL = { completed: "Completed", pending: "Pending", failed: "Failed" } as const;
const DEFAULT_PAGE_SIZE = 20;

export function TransactionsClient({ transactions }: { transactions: Transaction[] }) {
  const [viewingInvoice, setViewingInvoice] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const paged = transactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <TableCard>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-ink">All Transactions</h2>
        <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
          <Download className="size-3.5" strokeWidth={2} /> Export
        </button>
      </div>
      <TableHeaderRow>
        <Th>Date</Th>
        <Th className="flex-[1.6]">Description</Th>
        <Th align="right">Amount</Th>
        <Th align="right">Status</Th>
        <div className="w-12" />
      </TableHeaderRow>
      {paged.map((txn) => (
        <Tr key={txn.id}>
          <Td>{new Date(txn.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Td>
          <Td className="flex-[1.6]">{txn.description}</Td>
          <Td align="right" className={txn.status === "failed" ? "text-danger-text" : undefined}>
            {txn.amountInr > 0 ? `${txn.status === "failed" ? "" : "+"}₹${txn.amountInr.toFixed(2)}` : "—"}
          </Td>
          <Td align="right">
            <Badge tone={STATUS_TONE[txn.status]}>{STATUS_LABEL[txn.status]}</Badge>
          </Td>
          <div className="flex w-12 items-center justify-center">
            {txn.invoiceId && (
              <button type="button" onClick={() => setViewingInvoice(txn)} aria-label="View invoice" className="text-muted hover:text-accent">
                <FileText className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </Tr>
      ))}
      {transactions.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No transactions yet.</p>}
      <Pagination
        page={page}
        pageCount={pageCount}
        totalItems={transactions.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <Modal open={!!viewingInvoice} onClose={() => setViewingInvoice(null)} title="Invoice">
        {viewingInvoice && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Invoice</span>
              <span className="font-medium text-ink">{viewingInvoice.invoiceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Description</span>
              <span className="font-medium text-ink">{viewingInvoice.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Date</span>
              <span className="font-medium text-ink">
                {new Date(viewingInvoice.occurredAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-4">
              <span className="text-muted">Amount</span>
              <span className="text-lg font-semibold text-ink">₹{viewingInvoice.amountInr.toFixed(2)}</span>
            </div>
            <a href={`/api/billing/invoices/${viewingInvoice.invoiceId}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="mt-2 w-full gap-2">
                <Download className="size-4" strokeWidth={2} /> Download PDF
              </Button>
            </a>
          </div>
        )}
      </Modal>
    </TableCard>
  );
}
