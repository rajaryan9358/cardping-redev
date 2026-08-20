"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, Send, Coins, CreditCard, Bell, MessageSquare, Ban, CheckCircle2, IdCard } from "lucide-react";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { TextField } from "../../../components/ui/TextField";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { cn } from "@/lib/cn";
import { AdminUserListRow } from "../../../lib/repositories/adminUsers.repo";
import { Plan } from "../../../lib/repositories/adminSubscriptions.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import {
  setUserBlockedAction,
  setAccountBlockedAction,
  sendLowBalanceAlertAction,
  adjustUserCoinsAction,
  adjustAccountCoinsAction,
} from "./actions";
import { setUserPlanAction, setAccountPlanAction } from "../subscriptions/actions";
import { AdjustCoinsModal } from "./AdjustCoinsModal";
import { ChangePlanModal } from "../../../components/subscriptions/ChangePlanModal";
import { SendMessageModal, SendMessageTarget } from "./SendMessageModal";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "trial", label: "Trial" },
  { value: "subscription", label: "Subscription" },
  { value: "expired", label: "Expired" },
] as const;

const EXPIRY_QUICK_FILTERS = [
  { label: "Any time", days: null },
  { label: "Expiring ≤1d", days: 1 },
  { label: "Expiring ≤3d", days: 3 },
  { label: "Expiring ≤7d", days: 7 },
] as const;

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function UsersTable({
  rows,
  total,
  page,
  pageSize,
  search,
  status,
  expiresBefore,
  expiresAfter,
  sort,
  plans,
  lowBalanceThreshold,
}: {
  rows: AdminUserListRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  expiresBefore: string;
  expiresAfter: string;
  sort: string;
  plans: Plan[];
  lowBalanceThreshold: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [blockTarget, setBlockTarget] = useState<AdminUserListRow | null>(null);
  const [coinsTarget, setCoinsTarget] = useState<AdminUserListRow | null>(null);
  const [planTarget, setPlanTarget] = useState<AdminUserListRow | null>(null);
  const [messageTarget, setMessageTarget] = useState<AdminUserListRow | null>(null);
  const [alertingFor, setAlertingFor] = useState<string | null>(null);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  function navigate(next: {
    page?: number;
    search?: string;
    status?: string;
    expiresBefore?: string | null;
    expiresAfter?: string | null;
    sort?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      params.set("search", next.search);
      params.set("page", "1");
    }
    if (next.status !== undefined) {
      next.status ? params.set("status", next.status) : params.delete("status");
      params.set("page", "1");
    }
    if (next.expiresBefore !== undefined) {
      next.expiresBefore ? params.set("expiresBefore", next.expiresBefore) : params.delete("expiresBefore");
      params.set("page", "1");
    }
    if (next.expiresAfter !== undefined) {
      next.expiresAfter ? params.set("expiresAfter", next.expiresAfter) : params.delete("expiresAfter");
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
    window.location.href = `${pathname}?${params.toString()}`;
  }

  async function handleSendLowBalanceAlert(userId: string) {
    setAlertingFor(userId);
    try {
      await sendLowBalanceAlertAction(userId);
      router.refresh();
    } finally {
      setAlertingFor(null);
    }
  }

  const activeExpiryDays = EXPIRY_QUICK_FILTERS.find(
    (f) => f.days !== null && expiresBefore === daysFromNowIso(f.days),
  )?.days;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-warm p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => navigate({ status: tab.value })}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              status === tab.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("search");
            navigate({ search: String(value ?? "") });
          }}
          className="max-w-sm"
        >
          <TextField name="search" label="Search" placeholder="Name, email, WhatsApp or Telegram ID" defaultValue={search} />
        </form>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-2">Expiry</span>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-warm p-1">
            {EXPIRY_QUICK_FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  setCustomRangeOpen(false);
                  navigate({
                    expiresBefore: f.days === null ? null : daysFromNowIso(f.days),
                    expiresAfter: null,
                  });
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  (f.days === null ? !expiresBefore && !expiresAfter : activeExpiryDays === f.days)
                    ? "bg-surface text-ink shadow-soft"
                    : "text-muted hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomRangeOpen((v) => !v)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                customRangeOpen ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
              )}
            >
              Custom range
            </button>
          </div>
        </div>

        {customRangeOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const from = data.get("from");
              const to = data.get("to");
              navigate({
                expiresAfter: from ? new Date(String(from)).toISOString() : null,
                expiresBefore: to ? new Date(String(to)).toISOString() : null,
              });
            }}
            className="flex items-end gap-2"
          >
            <TextField name="from" type="date" label="From" />
            <TextField name="to" type="date" label="To" />
            <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">
              Apply
            </button>
          </form>
        )}
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>User</Th>
          <Th>Channels</Th>
          <SortableTh field="coin_balance" label="Coins" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th>Plan</Th>
          <Th>Status</Th>
          <SortableTh field="plan_expires_at" label="Expires" align="right" currentSort={sort} onSort={(f) => navigate({ sort: nextSortValue(sort, f) })} />
          <Th align="right">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No users found.</p>}
        {rows.map((user) => (
          <Tr key={user.id}>
            <Td>
              <Link href={`/users/${user.id}`} className="font-medium text-ink hover:underline">
                {user.full_name || "Unnamed"}
              </Link>
              <div className="text-xs text-muted">{user.email || "No email on file"}</div>
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                {user.wa_id && <MessageCircle className="size-4 text-success-text" strokeWidth={2} />}
                {user.telegram_id && <Send className="size-4 text-accent" strokeWidth={2} />}
                {!user.wa_id && !user.telegram_id && <span className="text-xs text-muted">—</span>}
              </div>
            </Td>
            <Td align="right">
              <div className="flex items-center justify-end gap-2">
                {user.effective_coin_balance}
                {user.effective_coin_balance <= lowBalanceThreshold && <Badge tone="warning">Low</Badge>}
              </div>
            </Td>
            <Td>{user.subscription_tier || "—"}</Td>
            <Td>
              {user.effective_blocked_at ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}
            </Td>
            <Td align="right">{user.effective_plan_expires_at ? formatDate(user.effective_plan_expires_at) : "—"}</Td>
            <Td align="right">
              <div className="flex justify-end">
                <RowActionsMenu
                  actions={[
                    {
                      label: "View cards",
                      icon: <IdCard className="size-3.5" strokeWidth={2} />,
                      onClick: () =>
                        (window.location.href = `/cards?userIds=${user.userIds.join(",")}&userName=${encodeURIComponent(user.full_name || "this person")}`),
                      disabled: user.userIds.length === 0,
                    },
                    { label: "Adjust coins", icon: <Coins className="size-3.5" strokeWidth={2} />, onClick: () => setCoinsTarget(user) },
                    {
                      label: user.effective_plan_id ? "Change plan" : "Assign plan",
                      icon: <CreditCard className="size-3.5" strokeWidth={2} />,
                      onClick: () => setPlanTarget(user),
                    },
                    {
                      label: "Send message",
                      icon: <MessageSquare className="size-3.5" strokeWidth={2} />,
                      onClick: () => setMessageTarget(user),
                      disabled: !user.detail_user_id || (!user.wa_id && !user.telegram_chat_id),
                    },
                    {
                      label: "Low-balance alert",
                      icon: <Bell className="size-3.5" strokeWidth={2} />,
                      onClick: () => handleSendLowBalanceAlert(user.detail_user_id!),
                      disabled: !user.detail_user_id || !user.wa_id || alertingFor === user.detail_user_id,
                    },
                    {
                      label: user.effective_blocked_at ? "Unblock" : "Block",
                      icon: user.effective_blocked_at ? (
                        <CheckCircle2 className="size-3.5" strokeWidth={2} />
                      ) : (
                        <Ban className="size-3.5" strokeWidth={2} />
                      ),
                      onClick: () => setBlockTarget(user),
                      tone: user.effective_blocked_at ? "default" : "danger",
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

      <ConfirmDialog
        open={blockTarget !== null}
        title={blockTarget?.effective_blocked_at ? "Unblock this user?" : "Block this user?"}
        description={
          blockTarget?.effective_blocked_at
            ? `${blockTarget?.full_name || "This user"} will be able to scan cards again.`
            : `${blockTarget?.full_name || "This user"} will no longer be able to scan cards on WhatsApp or Telegram.`
        }
        confirmLabel={blockTarget?.effective_blocked_at ? "Unblock" : "Block"}
        danger={!blockTarget?.effective_blocked_at}
        onCancel={() => setBlockTarget(null)}
        onConfirm={async () => {
          if (!blockTarget) return;
          const setBlocked = blockTarget.kind === "account" ? setAccountBlockedAction : setUserBlockedAction;
          await setBlocked(blockTarget.id, !blockTarget.effective_blocked_at);
          setBlockTarget(null);
        }}
      />

      <AdjustCoinsModal
        target={coinsTarget}
        onConfirm={coinsTarget?.kind === "account" ? adjustAccountCoinsAction : adjustUserCoinsAction}
        onClose={() => setCoinsTarget(null)}
      />

      <ChangePlanModal
        userId={planTarget?.id ?? null}
        userName={planTarget?.full_name || "this user"}
        plans={plans}
        onConfirm={planTarget?.kind === "account" ? setAccountPlanAction : setUserPlanAction}
        onClose={() => {
          setPlanTarget(null);
          router.refresh();
        }}
      />

      <SendMessageModal
        user={
          messageTarget?.detail_user_id
            ? ({
                user_id: messageTarget.detail_user_id,
                full_name: messageTarget.full_name,
                wa_id: messageTarget.wa_id,
                telegram_chat_id: messageTarget.telegram_chat_id,
                last_login: messageTarget.last_login,
                effective_plan_expires_at: messageTarget.effective_plan_expires_at,
              } satisfies SendMessageTarget)
            : null
        }
        onClose={() => setMessageTarget(null)}
      />
    </div>
  );
}
