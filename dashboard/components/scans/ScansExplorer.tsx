"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  MoreVertical,
  Pencil,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { TableCard, TableHeaderRow, Th, Td, Tr } from "@/components/ui/Table";
import { TagAutocomplete } from "@/components/ui/TagAutocomplete";
import { TagChip } from "@/components/ui/TagChip";
import { Pagination } from "@/components/ui/Pagination";
import { MultiSelectDropdown } from "@/components/ui/MultiSelectDropdown";
import { cn } from "@/lib/cn";
import { EventRecord, VisitingCard } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";

const CHANNEL_ICON: Record<VisitingCard["uploadedBy"], string> = {
  whatsapp: "/icons/channel-whatsapp.svg",
  telegram: "/icons/channel-telegram.svg",
};

type SortKey = "fullName" | "companyName" | "scannedAt";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function exportCsv(cards: VisitingCard[]) {
  const headers = ["Name", "Company", "Job Title", "Email", "Phone", "Event", "Tags", "Channel", "Scanned Date"];
  const rows = cards.map((c) => [
    c.fullName,
    c.companyName ?? "",
    c.jobTitle ?? "",
    c.businessEmail ?? "",
    c.phone1 ?? "",
    c.eventName,
    c.tags.join("; "),
    c.uploadedBy,
    formatDate(c.scannedAt),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cardping-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface ScansExplorerProps {
  initialCards: VisitingCard[];
  events: EventRecord[];
  allTags: string[];
  showEventFilter?: boolean;
  showToolbar?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  limit?: number;
  initialQuery?: string;
}

export function ScansExplorer({
  initialCards,
  events,
  allTags,
  showEventFilter = true,
  showToolbar = true,
  showPagination = true,
  pageSize = 8,
  limit,
  initialQuery = "",
}: ScansExplorerProps) {
  const [cards, setCards] = useState(initialCards);
  const [query, setQuery] = useState(initialQuery);
  // The browse/filter dropdown keeps every event (including inactive ones)
  // so cards from a closed-out event stay findable; only the "move to
  // event" picker below is restricted to active ones — an inactive event
  // isn't a valid destination to (re-)assign a card into.
  const activeEvents = events.filter((e) => e.activeStatus !== "inactive");
  const [eventFilter, setEventFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("scannedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<VisitingCard | "bulk" | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveEventId, setMoveEventId] = useState("");

  const filtered = useMemo(() => {
    let result = cards.filter((card) => {
      if (card.archived !== showArchived) return false;
      if (eventFilter.length && !eventFilter.includes(card.eventId)) return false;
      if (tagFilter.length && !tagFilter.some((tag) => card.tags.includes(tag))) return false;
      if (dateFrom && card.scannedAt < dateFrom) return false;
      if (dateTo && card.scannedAt > `${dateTo}T23:59:59`) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = `${card.fullName} ${card.companyName ?? ""} ${card.jobTitle ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "scannedAt") return dir * (new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime());
      return dir * String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
    });

    return result;
  }, [cards, eventFilter, tagFilter, dateFrom, dateTo, query, showArchived, sortKey, sortDir]);

  const visible = limit ? filtered.slice(0, limit) : filtered;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const paged = showPagination ? visible.slice((page - 1) * pageSize, page * pageSize) : visible;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === paged.length ? new Set() : new Set(paged.map((c) => c.id))));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

async function confirmDelete() {
    if (deleteTarget === "bulk") {
      const ids = Array.from(selected);
      await clientFetch("/api/cards/bulk", { method: "DELETE", body: JSON.stringify({ ids }) });
      setCards((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
    } else if (deleteTarget) {
      await clientFetch(`/api/cards/${deleteTarget.id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  async function applyBulkTags() {
    const ids = Array.from(selected);
    await clientFetch("/api/cards/bulk", { method: "PATCH", body: JSON.stringify({ ids, addTags: bulkTags }) });
    setCards((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, tags: Array.from(new Set([...c.tags, ...bulkTags])) } : c)));
    setBulkTags([]);
    setTagModalOpen(false);
    setSelected(new Set());
  }

  async function applyBulkMove() {
    const event = events.find((e) => e.id === moveEventId);
    if (!event) return;
    const ids = Array.from(selected);
    await clientFetch("/api/cards/bulk", { method: "PATCH", body: JSON.stringify({ ids, eventId: event.id }) });
    setCards((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, eventId: event.id, eventName: event.name } : c)));
    setMoveModalOpen(false);
    setMoveEventId("");
    setSelected(new Set());
  }

  const SortIcon = ({ column }: { column: SortKey }) =>
    sortKey !== column ? (
      <ArrowUpDown className="size-3 opacity-40" strokeWidth={2} />
    ) : sortDir === "asc" ? (
      <ArrowUp className="size-3" strokeWidth={2} />
    ) : (
      <ArrowDown className="size-3" strokeWidth={2} />
    );

  return (
    <div className="flex flex-col gap-4">
      {showToolbar &&
        (selected.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold">{selected.size} selected</span>
              <button type="button" onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-white/70 hover:text-white">
                <X className="size-3.5" /> Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="border-white/20 bg-white/10 py-1.5 text-white hover:bg-white/20" onClick={() => setTagModalOpen(true)}>
                Add Tag
              </Button>
              <Button variant="secondary" className="border-white/20 bg-white/10 py-1.5 text-white hover:bg-white/20" onClick={() => setMoveModalOpen(true)}>
                Move to Event
              </Button>
              <Button variant="dangerSolid" className="gap-1.5 py-1.5" onClick={() => setDeleteTarget("bulk")}>
                <Trash2 className="size-3.5" strokeWidth={2} /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">
                {visible.length} {showArchived ? "archived" : "active"} lead{visible.length === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs font-semibold text-accent hover:text-accent-hover">
                {showArchived ? "← Back to active" : "View archived"}
              </button>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  placeholder="Search leads..."
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              {showEventFilter && (
                <MultiSelectDropdown
                  label="Events"
                  options={events.map((event) => ({ value: event.id, label: event.name }))}
                  selected={eventFilter}
                  onChange={setEventFilter}
                  className="w-44"
                />
              )}
              <MultiSelectDropdown
                label="Tags"
                options={allTags.map((tag) => ({ value: tag, label: tag }))}
                selected={tagFilter}
                onChange={setTagFilter}
                className="w-44"
              />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none" />
              <span className="text-xs text-muted">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none" />
              <Button variant="secondary" className="shrink-0 gap-1.5 px-3 py-2 text-xs" onClick={() => exportCsv(visible)}>
                <Download className="size-3.5" strokeWidth={2} /> Export
              </Button>
            </div>
          </div>
        ))}

      <TableCard>
        <TableHeaderRow>
          <div className="flex items-center px-6 py-3">
            <input
              type="checkbox"
              checked={paged.length > 0 && selected.size === paged.length}
              onChange={toggleAll}
              className="size-4 rounded border-border text-accent"
            />
          </div>
          <Th className="flex-[1.4]">
            <button type="button" onClick={() => handleSort("fullName")} className="flex items-center gap-1 hover:text-ink">
              Name <SortIcon column="fullName" />
            </button>
          </Th>
          <Th>
            <button type="button" onClick={() => handleSort("companyName")} className="flex items-center gap-1 hover:text-ink">
              Company <SortIcon column="companyName" />
            </button>
          </Th>
          <Th>Job Title</Th>
          <Th>Event</Th>
          <Th className="flex-[1.4]">Tags</Th>
          <Th align="center">Channel</Th>
          <Th align="right">
            <button type="button" onClick={() => handleSort("scannedAt")} className="ml-auto flex items-center gap-1 hover:text-ink">
              Scanned <SortIcon column="scannedAt" />
            </button>
          </Th>
          <div className="w-10" />
        </TableHeaderRow>

        {paged.map((card) => (
          <Tr key={card.id}>
            <div className="flex items-center px-6 py-3.5">
              <input type="checkbox" checked={selected.has(card.id)} onChange={() => toggle(card.id)} className="size-4 rounded border-border text-accent" />
            </div>
            <Td className="flex-[1.4]">
              <Link href={`/directory/${card.id}`} className="flex items-center gap-3 hover:underline">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                  {initials(card.fullName)}
                </span>
                <span className="font-medium text-ink">{card.fullName}</span>
              </Link>
            </Td>
            <Td>{card.companyName}</Td>
            <Td>{card.jobTitle}</Td>
            <Td>
              <span className="rounded-full bg-active-bg px-2.5 py-0.5 text-xs text-muted-2">{card.eventName}</span>
            </Td>
            <Td className="flex-[1.4]">
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <TagChip key={tag}>{tag}</TagChip>
                ))}
              </div>
            </Td>
            <Td align="center">
              <Image src={CHANNEL_ICON[card.uploadedBy]} alt={card.uploadedBy} width={26} height={26} className="mx-auto" />
            </Td>
            <Td align="right">{formatDate(card.scannedAt)}</Td>
            <div className="relative flex w-10 items-center justify-center text-muted">
              <button type="button" onClick={() => setOpenMenuId(openMenuId === card.id ? null : card.id)} className="hover:text-ink">
                <MoreVertical className="size-4" strokeWidth={2} />
              </button>
              {openMenuId === card.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                  <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                    <Link href={`/directory/${card.id}/edit`} className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-active-bg">
                      <Pencil className="size-3.5" strokeWidth={2} /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        setDeleteTarget(card);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger-text hover:bg-danger-bg"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </Tr>
        ))}

        {paged.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted">{showArchived ? "No archived leads." : "No leads match your filters yet."}</p>
          </div>
        )}

        {showPagination && paged.length > 0 && <Pagination page={page} pageCount={pageCount} totalItems={visible.length} pageSize={pageSize} onPageChange={setPage} />}
      </TableCard>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} leads?` : `Delete ${deleteTarget ? deleteTarget.fullName : ""}?`}
        description="This can't be undone. The contact and any notes or voice memos attached to it will be permanently removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        open={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        title={`Add tags to ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTagModalOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkTags} disabled={bulkTags.length === 0}>
              <TagIcon className="size-4" strokeWidth={2} /> Apply
            </Button>
          </>
        }
      >
        <TagAutocomplete tags={bulkTags} onChange={setBulkTags} suggestions={allTags} />
      </Modal>

      <Modal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title={`Move ${selected.size} lead${selected.size === 1 ? "" : "s"} to event`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveModalOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkMove} disabled={!moveEventId}>Move</Button>
          </>
        }
      >
        <select
          value={moveEventId}
          onChange={(e) => setMoveEventId(e.target.value)}
          className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">Select an event...</option>
          {activeEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </Modal>
    </div>
  );
}
