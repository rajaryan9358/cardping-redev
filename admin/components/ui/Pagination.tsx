"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  // Optional — a table that hasn't wired up a variable page size yet can
  // omit these and just get the count label + prev/next/page-number row
  // as before.
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Windowed page numbers (first, last, current ± 1, "…" for gaps) instead
// of one button per page — unbounded buttons for e.g. a 50-page table
// would overflow the row and become unusable.
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted">
          Showing {start}–{end} of {totalItems}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Show
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            per page
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-active-bg hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="flex size-7 items-center justify-center text-xs text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-medium",
                p === page ? "bg-accent text-white" : "text-muted-2 hover:bg-active-bg",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-active-bg hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
