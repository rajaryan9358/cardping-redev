"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bell, CreditCard, MessageCircle, Send } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { Plan, SubscribedUserRow } from "../../../lib/repositories/adminSubscriptions.repo";
import { formatDate } from "../../../lib/format";
import { sendRenewalReminderAction, setUserPlanAction, setAccountPlanAction } from "./actions";
import { ChangePlanModal } from "../../../components/subscriptions/ChangePlanModal";

export function SubscribedUsersTable({
  rows,
  plans,
  total,
  page,
  pageSize,
}: {
  rows: SubscribedUserRow[];
  plans: Plan[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [changePlanFor, setChangePlanFor] = useState<SubscribedUserRow | null>(null);

  function navigate(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleSendReminder(reminderUserId: string) {
    setSendingFor(reminderUserId);
    try {
      await sendRenewalReminderAction(reminderUserId);
      router.refresh();
    } finally {
      setSendingFor(null);
    }
  }

  return (
    <TableCard>
      <TableHeaderRow>
        <Th>Subscriber</Th>
        <Th>Channels</Th>
        <Th>Plan</Th>
        <Th>Status</Th>
        <Th align="right">Expires</Th>
        <Th align="right">Actions</Th>
      </TableHeaderRow>
      {rows.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted">No subscribed users yet.</p>
      )}
      {rows.map((row) => {
        const expired = row.plan_expires_at ? new Date(row.plan_expires_at).getTime() <= Date.now() : true;
        const plan = plans.find((p) => p.id === row.plan_id);
        return (
          <Tr key={row.id}>
            <Td>
              {row.detail_user_id ? (
                <Link href={`/users/${row.detail_user_id}`} className="font-medium text-ink hover:underline">
                  {row.full_name || "Unnamed"}
                </Link>
              ) : (
                <span className="font-medium text-ink">{row.full_name || "Unnamed"}</span>
              )}
              <div className="text-xs text-muted">{row.email || row.wa_id || "—"}</div>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                {row.channels.includes("whatsapp") && <MessageCircle className="size-4 text-success-text" strokeWidth={2} />}
                {row.channels.includes("telegram") && <Send className="size-4 text-accent" strokeWidth={2} />}
                {row.channels.length === 0 && <span className="text-xs text-muted">Not connected</span>}
              </div>
            </Td>
            <Td>{plan?.name || row.plan_id}</Td>
            <Td>{expired ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Active</Badge>}</Td>
            <Td align="right">{row.plan_expires_at ? formatDate(row.plan_expires_at) : "—"}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: sendingFor === row.reminder_user_id ? "Sending…" : "Send reminder",
                      icon: <Bell className="size-3.5" strokeWidth={2} />,
                      onClick: () => handleSendReminder(row.reminder_user_id!),
                      disabled: !row.reminder_user_id || sendingFor === row.reminder_user_id,
                    },
                    {
                      label: "Change plan",
                      icon: <CreditCard className="size-3.5" strokeWidth={2} />,
                      onClick: () => setChangePlanFor(row),
                    },
                  ]}
                />
              </div>
            </Td>
          </Tr>
        );
      })}

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / pageSize))}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={navigate}
      />

      <ChangePlanModal
        userId={changePlanFor?.id ?? null}
        userName={changePlanFor?.full_name || "this subscriber"}
        plans={plans}
        onConfirm={changePlanFor?.kind === "account" ? setAccountPlanAction : setUserPlanAction}
        onClose={() => {
          setChangePlanFor(null);
          router.refresh();
        }}
      />
    </TableCard>
  );
}
