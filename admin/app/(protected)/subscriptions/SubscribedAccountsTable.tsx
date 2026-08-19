"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { Plan, SubscribedAccountRow } from "../../../lib/repositories/adminSubscriptions.repo";
import { formatDate } from "../../../lib/format";
import { setAccountPlanAction } from "./actions";
import { ChangePlanModal } from "../../../components/subscriptions/ChangePlanModal";

/** Dashboard logins with a plan but no linked WhatsApp/Telegram channel —
 * invisible to SubscribedUsersTable, which is keyed by channel identity.
 * Small, separate section rather than merging into that table, since
 * these rows have no wa_id/user detail page to link to. */
export function SubscribedAccountsTable({
  rows,
  plans,
  total,
  page,
  pageSize,
}: {
  rows: SubscribedAccountRow[];
  plans: Plan[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [changePlanFor, setChangePlanFor] = useState<SubscribedAccountRow | null>(null);

  function navigate(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("accountsPage", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TableCard>
      <p className="border-b border-border px-6 py-3 text-sm text-muted">
        Dashboard logins with an active plan that haven&apos;t linked a WhatsApp or Telegram number yet — they
        won&apos;t show up in Subscribed Users, since that list is keyed by channel identity.
      </p>
      <TableHeaderRow>
        <Th>Account</Th>
        <Th>Plan</Th>
        <Th>Status</Th>
        <Th align="right">Expires</Th>
        <Th align="right">Actions</Th>
      </TableHeaderRow>
      {rows.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted">No subscribed accounts without a linked channel.</p>
      )}
      {rows.map((row) => {
        const expired = row.plan_expires_at ? new Date(row.plan_expires_at).getTime() <= Date.now() : true;
        const plan = plans.find((p) => p.id === row.plan_id);
        return (
          <Tr key={row.account_id}>
            <Td>
              <span className="font-medium text-ink">{row.full_name || "Unnamed account"}</span>
              <div className="text-xs text-muted">{row.email || "—"}</div>
            </Td>
            <Td>{plan?.name || row.plan_id}</Td>
            <Td>{expired ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Active</Badge>}</Td>
            <Td align="right">{row.plan_expires_at ? formatDate(row.plan_expires_at) : "—"}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
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
        userId={changePlanFor?.account_id ?? null}
        userName={changePlanFor?.full_name || "this account"}
        plans={plans}
        onConfirm={setAccountPlanAction}
        onClose={() => {
          setChangePlanFor(null);
          router.refresh();
        }}
      />
    </TableCard>
  );
}
