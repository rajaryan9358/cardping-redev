"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, IdCard, Pencil, Trash2, X } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { AdminEventRow } from "../../../lib/repositories/adminEvents.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import { deleteEventAction, bulkDeleteEventsAction } from "./actions";
import { EditEventModal } from "./EditEventModal";

export function EventsTable({
  rows,
  total,
  page,
  pageSize,
  search,
  sort,
}: {
  rows: AdminEventRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<AdminEventRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminEventRow | "bulk" | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function navigate(next: { page?: number; search?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
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
    // Cache last had for it — stale rows included — before router.refresh()
    // gets a chance to correct it a moment later.
    window.location.href = `/admin${pathname}?${params.toString()}`;
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
        await bulkDeleteEventsAction(Array.from(selected), deleteAck);
        setSelected(new Set());
      } else if (deleteTarget) {
        await deleteEventAction(deleteTarget.id, deleteAck);
      }
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteAck(false);
    }
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("search");
            navigate({ search: String(value ?? "") });
          }}
          className="max-w-sm"
        >
          <TextField name="search" label="Search" placeholder="Event name, owner name, or email" defaultValue={search} />
        </form>
        <a href={`/admin/events/export?${searchParams.toString()}`}>
          <Button variant="secondary" className="gap-1.5">
            <Download className="size-4" strokeWidth={2} />
            Export CSV
          </Button>
        </a>
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
          <Th>Event</Th>
          <Th>Owner</Th>
          <Th>Status</Th>
          <SortableTh field="cardCount" label="Cards" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <SortableTh field="created_at" label="Created" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No events yet.</p>}
        {rows.map((event) => (
          <Tr key={event.id}>
            <Td className="flex-none w-10">
              <input
                type="checkbox"
                checked={selected.has(event.id)}
                onChange={() => toggle(event.id)}
                className="size-4 rounded border-border text-accent"
              />
            </Td>
            <Td>
              <Link href={`/events/${event.id}`} className="font-medium text-ink hover:underline">
                {event.name}
              </Link>
            </Td>
            <Td>{event.owner?.full_name || event.owner?.email || "—"}</Td>
            <Td>
              <Badge tone={event.status === "active" ? "success" : "pending"}>{event.status === "active" ? "Active" : "Inactive"}</Badge>
            </Td>
            <Td align="right">{event.cardCount}</Td>
            <Td align="right">{formatDate(event.created_at)}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "View cards",
                      icon: <IdCard className="size-3.5" strokeWidth={2} />,
                      onClick: () =>
                        (window.location.href = `/admin/cards?eventId=${event.id}&eventName=${encodeURIComponent(event.name)}`),
                    },
                    { label: "Edit", icon: <Pencil className="size-3.5" strokeWidth={2} />, onClick: () => setEditTarget(event) },
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-3.5" strokeWidth={2} />,
                      onClick: () => setDeleteTarget(event),
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

      <EditEventModal target={editTarget} onClose={() => setEditTarget(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} event${selected.size === 1 ? "" : "s"}?` : `Delete ${deleteTarget?.name || "this event"}?`}
        description={
          <div className="flex flex-col gap-3">
            <p>This can't be undone.</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={deleteAck}
                onChange={(e) => setDeleteAck(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-accent"
              />
              <span>Also permanently delete the cards scanned into {deleteTarget === "bulk" ? "these events" : "this event"} — otherwise they're kept, just unlinked from it.</span>
            </label>
          </div>
        }
        confirmLabel="Delete"
        confirmDisabled={deleting}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteAck(false);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
