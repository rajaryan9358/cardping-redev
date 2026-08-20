"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Eye, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { cn } from "@/lib/cn";
import { AdminCardRow } from "../../../lib/repositories/adminCards.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDateTime } from "../../../lib/format";
import { rerunExtractionAction, deleteCardAction, bulkDeleteCardsAction } from "./actions";
import { EditCardModal } from "./EditCardModal";

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
  search,
  userFilterName,
  eventFilterName,
}: {
  rows: AdminCardRow[];
  total: number;
  page: number;
  pageSize: number;
  maxConfidence: number;
  sort: string;
  search: string;
  userFilterName: string | null;
  eventFilterName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<AdminCardRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCardRow | "bulk" | null>(null);
  const [deleting, setDeleting] = useState(false);

  function navigate(next: { page?: number; maxConfidence?: string; sort?: string; search?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.maxConfidence !== undefined) {
      params.set("maxConfidence", next.maxConfidence);
      params.set("page", "1");
    }
    if (next.search !== undefined) {
      params.set("search", next.search);
      params.set("page", "1");
    }
    if (next.sort !== undefined) {
      next.sort ? params.set("sort", next.sort) : params.delete("sort");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    // Hard navigation, not router.push: a soft nav to a URL visited earlier
    // this session would instantly repaint whatever Next's client Router
    // Cache last had for it — stale confidence-filtered rows included —
    // before router.refresh() gets a chance to correct it a moment later.
    window.location.href = `/admin${pathname}?${params.toString()}`;
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      if (deleteTarget === "bulk") {
        await bulkDeleteCardsAction(Array.from(selected));
        setSelected(new Set());
      } else if (deleteTarget) {
        await deleteCardAction(deleteTarget.id);
      }
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function clearNarrowingFilters(): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("userIds");
    params.delete("userName");
    params.delete("eventId");
    params.delete("eventName");
    params.set("page", "1");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">{selected.size} selected</span>
            <button type="button" onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-white/70 hover:text-white">
              <X className="size-3.5" /> Clear
            </button>
          </div>
          <Button variant="dangerSolid" className="gap-1.5 py-1.5" onClick={() => setDeleteTarget("bulk")}>
            <Trash2 className="size-3.5" strokeWidth={2} /> Delete
          </Button>
        </div>
      )}

      {(userFilterName || eventFilterName) && (
        <div className="flex flex-wrap gap-2">
          {userFilterName && (
            <Link
              href={clearNarrowingFilters()}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-soft/70"
            >
              Showing cards for {userFilterName} <X className="size-3" strokeWidth={2} />
            </Link>
          )}
          {eventFilterName && (
            <Link
              href={clearNarrowingFilters()}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-soft/70"
            >
              Showing cards for {eventFilterName} <X className="size-3" strokeWidth={2} />
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("search");
            navigate({ search: String(value ?? "") });
          }}
          className="max-w-sm"
        >
          <TextField name="search" label="Search" placeholder="Name, company, email, or phone" defaultValue={search} />
        </form>
        <a href={`/admin/cards/export?${searchParams.toString()}`}>
          <Button variant="secondary" className="gap-1.5">
            <Download className="size-4" strokeWidth={2} />
            Export CSV
          </Button>
        </a>
      </div>

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
          <Th className="flex-none w-10">
            <input
              type="checkbox"
              checked={rows.length > 0 && selected.size === rows.length}
              onChange={toggleAll}
              className="size-4 rounded border-border text-accent"
            />
          </Th>
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
            <Td className="flex-none w-10">
              <input
                type="checkbox"
                checked={selected.has(card.id)}
                onChange={() => toggle(card.id)}
                className="size-4 rounded border-border text-accent"
              />
            </Td>
            <Td>
              <Link href={`/cards/${card.id}`} className="font-medium text-ink hover:underline">
                {card.full_name || "—"}
              </Link>
              <div className="text-xs text-muted">{card.company_name || "—"}</div>
            </Td>
            <Td>{card.user?.full_name || card.user?.email || "—"}</Td>
            <Td className="capitalize">{card.uploaded_by || "—"}</Td>
            <Td align="right">
              {card.extraction_confidence !== null ? `${Math.round(card.extraction_confidence * 100)}%` : "—"}
            </Td>
            <Td align="right">{formatDateTime(card.created_at)}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "View",
                      icon: <Eye className="size-3.5" strokeWidth={2} />,
                      onClick: () => (window.location.href = `/admin/cards/${card.id}`),
                    },
                    {
                      label: rerunning === card.id ? "Re-running…" : "Re-run extraction",
                      icon: <RefreshCw className="size-3.5" strokeWidth={2} />,
                      onClick: () => handleRerun(card.id),
                      disabled: rerunning === card.id,
                    },
                    { label: "Edit", icon: <Pencil className="size-3.5" strokeWidth={2} />, onClick: () => setEditTarget(card) },
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-3.5" strokeWidth={2} />,
                      onClick: () => setDeleteTarget(card),
                      tone: "danger",
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

      <EditCardModal target={editTarget} onClose={() => setEditTarget(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} card${selected.size === 1 ? "" : "s"}?` : `Delete this card?`}
        description="This can't be undone."
        confirmLabel="Delete"
        confirmDisabled={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
