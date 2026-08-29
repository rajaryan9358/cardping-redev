"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquare, Megaphone, History, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { FilterPopover, FilterOption } from "../../../components/ui/FilterPopover";
import { ChannelContactRow, WindowFilter } from "../../../lib/repositories/adminUsers.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import { saveListNavState, restoreListScroll } from "../../../lib/listNavState";
import { SendMessageModal, SendMessageTarget } from "./SendMessageModal";
import { BroadcastToUsersModal } from "./BroadcastToUsersModal";
import { BroadcastHistoryModal } from "./BroadcastHistoryModal";

const WINDOW_LABELS: Record<string, string> = { within: "Within 24h", outside: "Outside 24h" };

export function ContactsTable({
  channel,
  rows,
  total,
  page,
  pageSize,
  search,
  sort,
  windowFilter,
}: {
  channel: "whatsapp" | "telegram";
  rows: ChannelContactRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: string;
  windowFilter: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [messageTarget, setMessageTarget] = useState<ChannelContactRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // null = closed; otherwise the exact ids to broadcast to (empty array =
  // "everyone matching the current filters", not "nobody").
  const [broadcastTargetIds, setBroadcastTargetIds] = useState<string[] | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const windowValue = windowFilter ? WINDOW_LABELS[windowFilter] ?? null : null;

  useEffect(() => {
    restoreListScroll(pathname, searchParams.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function navigate(next: { page?: number; pageSize?: number; search?: string; sort?: string; windowFilter?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      params.set("search", next.search);
      params.set("page", "1");
    }
    if (next.sort !== undefined) {
      next.sort ? params.set("sort", next.sort) : params.delete("sort");
    }
    if (next.windowFilter !== undefined) {
      next.windowFilter ? params.set("window", next.windowFilter) : params.delete("window");
      params.set("page", "1");
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    saveListNavState(pathname, params.toString());
    window.location.href = `/admin${pathname}?${params.toString()}`;
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
          <Button variant="secondary" className="gap-1.5 py-1.5" onClick={() => setBroadcastTargetIds(Array.from(selected))}>
            <Megaphone className="size-3.5" strokeWidth={2} /> Broadcast message
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("search");
          navigate({ search: String(value ?? "") });
        }}
        className="max-w-sm"
      >
        <TextField
          name="search"
          label="Search"
          placeholder={channel === "whatsapp" ? "Name, email, or WhatsApp number" : "Name, email, or Telegram ID"}
          defaultValue={search}
        />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-2">Filters:</span>
          <FilterPopover label="24h window" value={windowValue} onClear={() => navigate({ windowFilter: null })}>
            <div className="flex flex-col gap-1">
              <FilterOption label="Any" selected={!windowFilter} onClick={() => navigate({ windowFilter: null })} />
              <FilterOption label="Within 24h" selected={windowFilter === "within"} onClick={() => navigate({ windowFilter: "within" })} />
              <FilterOption label="Outside 24h" selected={windowFilter === "outside"} onClick={() => navigate({ windowFilter: "outside" })} />
            </div>
          </FilterPopover>
        </div>
        <Button variant="secondary" className="gap-1.5" onClick={() => setBroadcastTargetIds([])} disabled={total === 0}>
          <Megaphone className="size-4" strokeWidth={2} />
          Broadcast to filtered
        </Button>
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
          <Th>Contact</Th>
          <Th>Credits</Th>
          <SortableTh field="created_at" label="First contacted" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <SortableTh field="last_login" label="Last seen" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No contacts found.</p>}
        {rows.map((contact) => (
          <Tr key={contact.id}>
            <Td className="flex-none w-10">
              <input
                type="checkbox"
                checked={selected.has(contact.id)}
                onChange={() => toggle(contact.id)}
                className="size-4 rounded border-border text-accent"
              />
            </Td>
            <Td>
              <Link
                href={`/users/${contact.id}`}
                onClick={() => saveListNavState(pathname, searchParams.toString())}
                className="font-medium text-ink hover:underline"
              >
                {contact.full_name || "Unnamed"}
              </Link>
              <div className="text-xs text-muted">{contact.email || "Messaged the bot, hasn't signed up"}</div>
            </Td>
            <Td>{contact.coin_balance}</Td>
            <Td align="right">{formatDate(contact.created_at)}</Td>
            <Td align="right">{contact.last_login ? formatDate(contact.last_login) : "—"}</Td>
            <Td align="right">
              <div className="flex items-center justify-end gap-2">
                <RowActionsMenu
                  actions={[
                    {
                      label: "Send message",
                      icon: <MessageSquare className="size-3.5" strokeWidth={2} />,
                      onClick: () => setMessageTarget(contact),
                    },
                    {
                      label: "Broadcast history",
                      icon: <History className="size-3.5" strokeWidth={2} />,
                      onClick: () => setHistoryTarget(contact.id),
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
          onPageSizeChange={(size) => navigate({ pageSize: size })}
        />
      </TableCard>

      <SendMessageModal
        user={
          messageTarget
            ? ({
                user_id: messageTarget.id,
                full_name: messageTarget.full_name,
                wa_id: channel === "whatsapp" ? messageTarget.identifier : null,
                telegram_chat_id: channel === "telegram" ? messageTarget.identifier : null,
                last_login: messageTarget.last_login,
                effective_plan_expires_at: null,
              } satisfies SendMessageTarget)
            : null
        }
        onClose={() => setMessageTarget(null)}
      />

      <BroadcastToUsersModal
        open={broadcastTargetIds !== null}
        source={channel === "whatsapp" ? "whatsapp_contacts" : "telegram_contacts"}
        selectedIds={broadcastTargetIds ?? []}
        filters={{ search, sort, windowFilter: (windowFilter || undefined) as WindowFilter | undefined }}
        onClose={() => setBroadcastTargetIds(null)}
      />

      <BroadcastHistoryModal userIds={historyTarget ? [historyTarget] : null} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}
