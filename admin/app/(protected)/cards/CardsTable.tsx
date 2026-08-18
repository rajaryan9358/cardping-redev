"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { cn } from "@/lib/cn";
import { AdminCardRow } from "../../../lib/repositories/adminCards.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import { rerunExtractionAction } from "./actions";

const CONFIDENCE_OPTIONS = [
  { label: "≤50%", value: "0.5" },
  { label: "≤60%", value: "0.6" },
  { label: "≤70%", value: "0.7" },
  { label: "≤80%", value: "0.8" },
  { label: "≤90%", value: "0.9" },
  { label: "All", value: "1" },
] as const;

export function CardsTable({
  rows,
  total,
  page,
  pageSize,
  maxConfidence,
  sort,
}: {
  rows: AdminCardRow[];
  total: number;
  page: number;
  pageSize: number;
  maxConfidence: number;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rerunning, setRerunning] = useState<string | null>(null);

  function navigate(next: { page?: number; maxConfidence?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.maxConfidence !== undefined) {
      params.set("maxConfidence", next.maxConfidence);
      params.set("page", "1");
    }
    if (next.sort !== undefined) {
      next.sort ? params.set("sort", next.sort) : params.delete("sort");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleRerun(cardId: string) {
    setRerunning(cardId);
    try {
      await rerunExtractionAction(cardId);
      router.refresh();
    } finally {
      setRerunning(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-2">Confidence at or below</span>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-warm p-1">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => navigate({ maxConfidence: opt.value })}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                String(maxConfidence) === opt.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>Card</Th>
          <Th>Scanned by</Th>
          <Th>Channel</Th>
          <SortableTh field="extraction_confidence" label="Confidence" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <SortableTh field="created_at" label="Scanned" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted">No cards at or below this confidence.</p>
        )}
        {rows.map((card) => (
          <Tr key={card.id}>
            <Td>
              <div className="font-medium text-ink">{card.full_name || "—"}</div>
              <div className="text-xs text-muted">{card.company_name || "—"}</div>
            </Td>
            <Td>{card.user?.full_name || card.user?.email || "—"}</Td>
            <Td className="capitalize">{card.uploaded_by || "—"}</Td>
            <Td align="right">
              {card.extraction_confidence !== null ? `${Math.round(card.extraction_confidence * 100)}%` : "—"}
            </Td>
            <Td align="right">{formatDate(card.created_at)}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: rerunning === card.id ? "Re-running…" : "Re-run extraction",
                      icon: <RefreshCw className="size-3.5" strokeWidth={2} />,
                      onClick: () => handleRerun(card.id),
                      disabled: rerunning === card.id,
                    },
                  ]}
                />
              </div>
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
