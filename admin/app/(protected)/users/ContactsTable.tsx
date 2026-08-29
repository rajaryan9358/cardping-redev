"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { TextField } from "../../../components/ui/TextField";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { ChannelContactRow } from "../../../lib/repositories/adminUsers.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import { saveListNavState, restoreListScroll } from "../../../lib/listNavState";
import { sendLowBalanceAlertAction } from "./actions";
import { SendMessageModal, SendMessageTarget } from "./SendMessageModal";

export function ContactsTable({
  channel,
  rows,
  total,
  page,
  pageSize,
  search,
  sort,
}: {
  channel: "whatsapp" | "telegram";
  rows: ChannelContactRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [messageTarget, setMessageTarget] = useState<ChannelContactRow | null>(null);
  const [alertingFor, setAlertingFor] = useState<string | null>(null);

  useEffect(() => {
    restoreListScroll(pathname, searchParams.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: { page?: number; pageSize?: number; search?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      params.set("search", next.search);
      params.set("page", "1");
    }
    if (next.sort !== undefined) {
      next.sort ? params.set("sort", next.sort) : params.delete("sort");
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page !== undefined) params.set("page", String(next.page));
    saveListNavState(pathname, params.toString());
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  async function handleSendLowBalanceAlert(userId: string) {
    setAlertingFor(userId);
    try {
      await sendLowBalanceAlertAction(userId);
    } finally {
      setAlertingFor(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      <TableCard>
        <TableHeaderRow>
          <Th>Contact</Th>
          <Th>Credits</Th>
          <SortableTh field="created_at" label="First contacted" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <SortableTh field="last_login" label="Last seen" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No contacts found.</p>}
        {rows.map((contact) => (
          <Tr key={contact.id}>
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
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "Send message",
                      icon: <MessageSquare className="size-3.5" strokeWidth={2} />,
                      onClick: () => setMessageTarget(contact),
                    },
                    {
                      label: "Low-balance alert",
                      icon: <Bell className="size-3.5" strokeWidth={2} />,
                      onClick: () => handleSendLowBalanceAlert(contact.id),
                      disabled: channel !== "whatsapp" || alertingFor === contact.id,
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
    </div>
  );
}
