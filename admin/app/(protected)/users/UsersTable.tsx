"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, Send, Coins, CreditCard, Bell, MessageSquare, Megaphone, History, Ban, CheckCircle2, IdCard, Pencil, Trash2, X, Download } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../components/ui/Table";
import { SortableTh } from "../../../components/ui/SortableTh";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { TextField } from "../../../components/ui/TextField";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { FilterPopover, FilterOption } from "../../../components/ui/FilterPopover";
import { cn } from "@/lib/cn";
import { AdminUserListRow, UserStatusFilter, WindowFilter } from "../../../lib/repositories/adminUsers.repo";
import { Plan } from "../../../lib/repositories/adminSubscriptions.repo";
import { nextSortValue } from "../../../lib/sort";
import { formatDate } from "../../../lib/format";
import { saveListNavState, restoreListScroll } from "../../../lib/listNavState";
import {
  setUserBlockedAction,
  setAccountBlockedAction,
  sendLowBalanceAlertAction,
  adjustUserCoinsAction,
  adjustAccountCoinsAction,
  deleteUserAction,
  deleteAccountAction,
  bulkDeleteUsersAction,
} from "./actions";
import { setUserPlanAction, setAccountPlanAction } from "../subscriptions/actions";
import { AdjustCoinsModal } from "./AdjustCoinsModal";
import { EditUserModal } from "./EditUserModal";
import { ChangePlanModal } from "../../../components/subscriptions/ChangePlanModal";
import { SendMessageModal, SendMessageTarget } from "./SendMessageModal";
import { BroadcastToUsersModal } from "./BroadcastToUsersModal";
import { BroadcastHistoryModal } from "./BroadcastHistoryModal";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "trial", label: "Trial" },
  { value: "subscription", label: "Subscription" },
  { value: "expired", label: "Expired" },
  { value: "needs_info", label: "Needs Info" },
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

const WINDOW_LABELS: Record<string, string> = { within: "Within 24h", outside: "Outside 24h" };

export function UsersTable({
  rows,
  total,
  page,
  pageSize,
  search,
  status,
  expiresBefore,
  expiresAfter,
  coinMin,
  coinMax,
  planId,
  hasWhatsapp,
  hasTelegram,
  windowFilter,
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
  coinMin: string;
  coinMax: string;
  planId: string;
  hasWhatsapp: boolean;
  hasTelegram: boolean;
  windowFilter: string;
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
  const [editTarget, setEditTarget] = useState<AdminUserListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListRow | "bulk" | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alertingFor, setAlertingFor] = useState<string | null>(null);
  const [alertResult, setAlertResult] = useState<{ id: string; ok: boolean } | null>(null);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // null = closed; otherwise the exact ids to broadcast to (empty array =
  // "everyone matching the current filters", not "nobody" — see
  // BroadcastToUsersModal).
  const [broadcastTargetIds, setBroadcastTargetIds] = useState<string[] | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminUserListRow | null>(null);

  const currentFilters = {
    search,
    status: (status || undefined) as UserStatusFilter | undefined,
    expiresBefore: expiresBefore || undefined,
    expiresAfter: expiresAfter || undefined,
    coinMin: coinMin ? Number(coinMin) : undefined,
    coinMax: coinMax ? Number(coinMax) : undefined,
    planId: planId || undefined,
    hasWhatsapp: hasWhatsapp || undefined,
    hasTelegram: hasTelegram || undefined,
    windowFilter: (windowFilter || undefined) as WindowFilter | undefined,
    sort: sort || undefined,
  };

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

  async function confirmDelete() {
    setDeleting(true);
    try {
      if (deleteTarget === "bulk") {
        const targets = rows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, kind: r.kind }));
        await bulkDeleteUsersAction(targets, deleteAck);
        setSelected(new Set());
      } else if (deleteTarget) {
        if (deleteTarget.kind === "account") await deleteAccountAction(deleteTarget.id, deleteAck);
        else await deleteUserAction(deleteTarget.id);
      }
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteAck(false);
    }
  }

  function navigate(next: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    expiresBefore?: string | null;
    expiresAfter?: string | null;
    coinMin?: string | null;
    coinMax?: string | null;
    planId?: string | null;
    hasWhatsapp?: boolean | null;
    hasTelegram?: boolean | null;
    windowFilter?: string | null;
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
    if (next.coinMin !== undefined) {
      next.coinMin ? params.set("coinMin", next.coinMin) : params.delete("coinMin");
      params.set("page", "1");
    }
    if (next.coinMax !== undefined) {
      next.coinMax ? params.set("coinMax", next.coinMax) : params.delete("coinMax");
      params.set("page", "1");
    }
    if (next.planId !== undefined) {
      next.planId ? params.set("planId", next.planId) : params.delete("planId");
      params.set("page", "1");
    }
    if (next.hasWhatsapp !== undefined) {
      next.hasWhatsapp ? params.set("hasWhatsapp", "1") : params.delete("hasWhatsapp");
      params.set("page", "1");
    }
    if (next.hasTelegram !== undefined) {
      next.hasTelegram ? params.set("hasTelegram", "1") : params.delete("hasTelegram");
      params.set("page", "1");
    }
    if (next.windowFilter !== undefined) {
      next.windowFilter ? params.set("window", next.windowFilter) : params.delete("window");
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
    // Hard navigation, not router.push: a soft nav to a URL visited earlier
    // this session would instantly repaint whatever Next's client Router
    // Cache last had for it — stale rows included — before router.refresh()
    // gets a chance to correct it a moment later.
    window.location.href = `/admin${pathname}?${params.toString()}`;
  }

  async function handleSendLowBalanceAlert(userId: string) {
    setAlertingFor(userId);
    setAlertResult(null);
    try {
      const result = await sendLowBalanceAlertAction(userId);
      setAlertResult({ id: userId, ok: result.sent });
      router.refresh();
    } catch {
      setAlertResult({ id: userId, ok: false });
    } finally {
      setAlertingFor(null);
      setTimeout(() => setAlertResult(null), 4000);
    }
  }

  const activeExpiryDays = EXPIRY_QUICK_FILTERS.find(
    (f) => f.days !== null && expiresBefore === daysFromNowIso(f.days),
  )?.days;

  // Each filter's current-value display text, or null when unset — drives
  // both the FilterPopover trigger's inline summary and its active styling.
  const statusValue = status ? STATUS_TABS.find((t) => t.value === status)?.label ?? null : null;
  const expiryValue = !expiresBefore && !expiresAfter ? null : activeExpiryDays !== undefined ? `≤${activeExpiryDays}d` : "Custom";
  const creditsValue = coinMin || coinMax ? `${coinMin || "0"}–${coinMax || "∞"}` : null;
  const planValue = planId === "none" ? "No plan" : planId ? plans.find((p) => p.id === planId)?.name ?? null : null;
  const channelValue = hasWhatsapp && hasTelegram ? "WhatsApp + Telegram" : hasWhatsapp ? "WhatsApp" : hasTelegram ? "Telegram" : null;
  const windowValue = windowFilter ? WINDOW_LABELS[windowFilter] ?? null : null;
  const anyFilterActive = !!(statusValue || expiryValue || creditsValue || planValue || channelValue || windowValue);

  function clearAllFilters() {
    navigate({
      status: "",
      expiresBefore: null,
      expiresAfter: null,
      coinMin: null,
      coinMax: null,
      planId: null,
      hasWhatsapp: false,
      hasTelegram: false,
      windowFilter: null,
    });
    setCustomRangeOpen(false);
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
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="gap-1.5 py-1.5" onClick={() => setBroadcastTargetIds(Array.from(selected))}>
              <Megaphone className="size-3.5" strokeWidth={2} /> Broadcast message
            </Button>
            <Button variant="dangerSolid" className="gap-1.5 py-1.5" onClick={() => setDeleteTarget("bulk")}>
              <Trash2 className="size-3.5" strokeWidth={2} /> Delete
            </Button>
          </div>
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
        <TextField name="search" label="Search" placeholder="Name, email, WhatsApp or Telegram ID" defaultValue={search} />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-2">Filters:</span>

          <FilterPopover label="Status" value={statusValue} onClear={() => navigate({ status: "" })}>
            <div className="flex flex-col gap-1">
              {STATUS_TABS.map((tab) => (
                <FilterOption key={tab.value || "all"} label={tab.label} selected={status === tab.value} onClick={() => navigate({ status: tab.value })} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Expiry" value={expiryValue} onClear={() => { navigate({ expiresBefore: null, expiresAfter: null }); setCustomRangeOpen(false); }}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {EXPIRY_QUICK_FILTERS.map((f) => (
                <FilterOption
                  key={f.label}
                  label={f.label}
                  selected={f.days === null ? !expiresBefore && !expiresAfter : activeExpiryDays === f.days}
                  onClick={() => {
                    setCustomRangeOpen(false);
                    navigate({ expiresBefore: f.days === null ? null : daysFromNowIso(f.days), expiresAfter: null });
                  }}
                />
              ))}
              <FilterOption label="Custom range…" selected={customRangeOpen} onClick={() => setCustomRangeOpen((v) => !v)} />
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
                className="flex flex-col gap-2 border-t border-border pt-3"
              >
                <TextField name="from" type="date" label="From" />
                <TextField name="to" type="date" label="To" />
                <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
                  Apply
                </button>
              </form>
            )}
          </div>
        </FilterPopover>

        <FilterPopover label="Credits" value={creditsValue} onClear={() => navigate({ coinMin: null, coinMax: null })}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              navigate({
                coinMin: data.get("coinMin") ? String(data.get("coinMin")) : null,
                coinMax: data.get("coinMax") ? String(data.get("coinMax")) : null,
              });
            }}
            className="flex flex-col gap-2"
          >
            <TextField name="coinMin" type="number" label="Min" defaultValue={coinMin} placeholder="0" />
            <TextField name="coinMax" type="number" label="Max" defaultValue={coinMax} placeholder="Any" />
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              Apply
            </button>
          </form>
        </FilterPopover>

        <FilterPopover label="Plan" value={planValue} onClear={() => navigate({ planId: null })}>
          <div className="flex flex-col gap-1">
            <FilterOption label="All" selected={!planId} onClick={() => navigate({ planId: null })} />
            <FilterOption label="No plan" selected={planId === "none"} onClick={() => navigate({ planId: "none" })} />
            {plans.map((p) => (
              <FilterOption key={p.id} label={p.name} selected={planId === p.id} onClick={() => navigate({ planId: p.id })} />
            ))}
          </div>
        </FilterPopover>

        <FilterPopover
          label="Channel"
          value={channelValue}
          onClear={() => navigate({ hasWhatsapp: false, hasTelegram: false })}
        >
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-active-bg">
              <input
                type="checkbox"
                checked={hasWhatsapp}
                onChange={(e) => navigate({ hasWhatsapp: e.target.checked })}
                className="size-4 rounded border-border text-accent"
              />
              WhatsApp
            </label>
            <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-active-bg">
              <input
                type="checkbox"
                checked={hasTelegram}
                onChange={(e) => navigate({ hasTelegram: e.target.checked })}
                className="size-4 rounded border-border text-accent"
              />
              Telegram
            </label>
          </div>
        </FilterPopover>

        <FilterPopover label="24h window" value={windowValue} onClear={() => navigate({ windowFilter: null })}>
          <div className="flex flex-col gap-1">
            <FilterOption label="Any" selected={!windowFilter} onClick={() => navigate({ windowFilter: null })} />
            <FilterOption label="Within 24h" selected={windowFilter === "within"} onClick={() => navigate({ windowFilter: "within" })} />
            <FilterOption label="Outside 24h" selected={windowFilter === "outside"} onClick={() => navigate({ windowFilter: "outside" })} />
          </div>
        </FilterPopover>

          {anyFilterActive && (
            <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" className="gap-1.5" onClick={() => setBroadcastTargetIds([])} disabled={total === 0}>
            <Megaphone className="size-4" strokeWidth={2} />
            Broadcast to filtered
          </Button>
          <a href={`/admin/users/export?${searchParams.toString()}`}>
            <Button variant="secondary" className="gap-1.5">
              <Download className="size-4" strokeWidth={2} />
              Export CSV
            </Button>
          </a>
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
          <Th>User</Th>
          <Th className="flex-none w-28">Channels</Th>
          <SortableTh
            field="coin_balance"
            label="Credits"
            align="right"
            className="flex-none w-36"
            currentSort={sort}
            onSort={(f) => navigate({ sort: nextSortValue(sort, f) })}
          />
          <Th className="flex-none w-32">Plan</Th>
          <Th className="flex-none w-28">Status</Th>
          <SortableTh
            field="plan_expires_at"
            label="Expires"
            align="right"
            className="flex-none w-32"
            currentSort={sort}
            onSort={(f) => navigate({ sort: nextSortValue(sort, f) })}
          />
          <Th align="right" className="flex-none w-44">Actions</Th>
        </TableHeaderRow>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No users found.</p>}
        {rows.map((user) => (
          <Tr key={user.id}>
            <Td className="flex-none w-10">
              <input
                type="checkbox"
                checked={selected.has(user.id)}
                onChange={() => toggle(user.id)}
                className="size-4 rounded border-border text-accent"
              />
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <Link
                  href={`/users/${user.id}`}
                  onClick={() => saveListNavState(pathname, searchParams.toString())}
                  className="font-medium text-ink hover:underline"
                >
                  {user.full_name || "Unnamed"}
                </Link>
                {user.kind === "unlinked_user" && <Badge tone="pending">Contact only</Badge>}
              </div>
              <div className="text-xs text-muted">
                {user.email || (user.kind === "unlinked_user" ? "Messaged the bot, hasn't signed up" : "No email on file")}
              </div>
            </Td>
            <Td className="flex-none w-28">
              <div className="flex items-center gap-2">
                {user.wa_id && <MessageCircle className="size-4 text-success-text" strokeWidth={2} />}
                {user.telegram_id && <Send className="size-4 text-accent" strokeWidth={2} />}
                {!user.wa_id && !user.telegram_id && <span className="text-xs text-muted">—</span>}
              </div>
            </Td>
            <Td align="right" className="flex-none w-36">
              <div className="flex items-center justify-end gap-2">
                {user.effective_coin_balance}
                {user.effective_coin_balance <= lowBalanceThreshold && <Badge tone="warning">Low</Badge>}
              </div>
            </Td>
            <Td className="flex-none w-32">{user.subscription_tier || "—"}</Td>
            <Td className="flex-none w-28">
              {user.effective_blocked_at ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}
            </Td>
            <Td align="right" className="flex-none w-32">{user.effective_plan_expires_at ? formatDate(user.effective_plan_expires_at) : "—"}</Td>
            <Td align="right" className="flex-none w-44">
              <div className="flex items-center justify-end gap-2">
                {alertResult?.id === user.detail_user_id && (
                  <span className={cn("text-xs font-medium", alertResult.ok ? "text-success-text" : "text-danger-text")}>
                    {alertResult.ok ? "Alert sent" : "Failed to send"}
                  </span>
                )}
                <RowActionsMenu
                  actions={[
                    {
                      label: "View cards",
                      icon: <IdCard className="size-3.5" strokeWidth={2} />,
                      onClick: () =>
                        (window.location.href = `/admin/cards?userIds=${user.userIds.join(",")}&userName=${encodeURIComponent(user.full_name || "this person")}`),
                      disabled: user.userIds.length === 0,
                    },
                    { label: "Adjust credits", icon: <Coins className="size-3.5" strokeWidth={2} />, onClick: () => setCoinsTarget(user) },
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
                      label: "Broadcast history",
                      icon: <History className="size-3.5" strokeWidth={2} />,
                      onClick: () => setHistoryTarget(user),
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
                    { label: "Edit profile", icon: <Pencil className="size-3.5" strokeWidth={2} />, onClick: () => setEditTarget(user) },
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-3.5" strokeWidth={2} />,
                      onClick: () => setDeleteTarget(user),
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
          onPageSizeChange={(size) => navigate({ pageSize: size })}
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

      <EditUserModal target={editTarget} onClose={() => setEditTarget(null)} />

      <BroadcastToUsersModal
        open={broadcastTargetIds !== null}
        source="accounts"
        selectedIds={broadcastTargetIds ?? []}
        filters={currentFilters}
        onClose={() => setBroadcastTargetIds(null)}
      />

      <BroadcastHistoryModal userIds={historyTarget?.userIds ?? null} onClose={() => setHistoryTarget(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget === "bulk"
            ? `Delete ${selected.size} user${selected.size === 1 ? "" : "s"}?`
            : `Delete ${deleteTarget?.full_name || "this user"}?`
        }
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
              <span>
                {deleteTarget === "bulk"
                  ? "Also permanently delete events and cards for everyone selected — required for anyone with no dashboard account (their data cascades unconditionally); optional for the rest, who'd otherwise just be unlinked and kept."
                  : deleteTarget?.kind === "account"
                    ? "Also permanently delete this person's linked events and cards — otherwise they're kept, just unlinked from this account."
                    : "This will also permanently delete this person's events and cards — check to confirm you understand."}
              </span>
            </label>
          </div>
        }
        confirmLabel="Delete"
        confirmDisabled={!deleteAck || deleting}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteAck(false);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
