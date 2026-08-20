"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IdCard } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { AdminEventRow } from "../../../lib/repositories/adminEvents.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";

export function EventsTable({
  rows,
  total,
  page,
  pageSize,
  ownerSearch,
  sort,
}: {
  rows: AdminEventRow[];
  total: number;
  page: number;
  pageSize: number;
  ownerSearch: string;
  sort: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { page?: number; ownerSearch?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.ownerSearch !== undefined) {
      params.set("ownerSearch", next.ownerSearch);
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

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("ownerSearch");
          navigate({ ownerSearch: String(value ?? "") });
        }}
        className="max-w-sm"
      >
        <TextField name="ownerSearch" label="Filter by owner" placeholder="Owner name or email" defaultValue={ownerSearch} />
      </form>

      <TableCard>
        <TableHeaderRow>
          <Th>Event</Th>
          <Th>Owner</Th>
          <SortableTh field="cardCount" label="Cards" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <SortableTh field="created_at" label="Created" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No events yet.</p>}
        {rows.map((event) => (
          <Tr key={event.id}>
            <Td>
              <Link href={`/events/${event.id}`} className="font-medium text-ink hover:underline">
                {event.name}
              </Link>
            </Td>
            <Td>{event.owner?.full_name || event.owner?.email || "—"}</Td>
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
