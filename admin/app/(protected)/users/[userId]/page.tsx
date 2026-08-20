import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bell, MessageCircle, ScanLine, Send } from "lucide-react";
import { adminUsersRepo } from "../../../../lib/repositories/adminUsers.repo";
import { env } from "../../../../lib/env";
import { Badge } from "../../../../components/ui/Badge";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../../components/ui/Table";
import { formatDate, formatDateTime } from "../../../../lib/format";
import { UserDetailActions } from "./UserDetailActions";

export default async function UserDetailPage({ params }: { params: { userId: string } }) {
  const user = await adminUsersRepo.getUserDetail(params.userId);
  if (!user) notFound();

  const [events, cards, transactions, interactionHistory] = await Promise.all([
    adminUsersRepo.getUserEvents(user.userIds),
    adminUsersRepo.getUserCards(user.userIds),
    adminUsersRepo.getUserTransactions(user.userIds, user.kind === "account" ? user.id : null),
    adminUsersRepo.getUserInteractionHistory(user.userIds),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/users" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to users
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{user.full_name || "Unnamed user"}</h1>
            {user.effective_blocked_at ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span>{user.email || "No email on file"}</span>
            {user.channels.map((c) => (
              <span key={c.usersId + c.channel} className="flex items-center gap-1.5">
                {c.channel === "whatsapp" ? (
                  <MessageCircle className="size-4 text-success-text" strokeWidth={2} />
                ) : (
                  <Send className="size-4 text-accent" strokeWidth={2} />
                )}
                {c.identifier}
              </span>
            ))}
            {user.channels.length === 0 && <span className="text-xs">No channel connected</span>}
          </div>
          <p className="mt-2 text-xs text-muted">
            Joined {formatDate(user.created_at)} · Plan: {user.subscription_tier || user.effective_plan_id || "—"} ·
            Marketing opt-in: {user.marketing_opt_in ? "Yes" : "No"}
          </p>
        </div>

        <UserDetailActions user={user} />
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Coin balance</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-semibold text-ink">{user.effective_coin_balance}</p>
            {user.effective_coin_balance <= env.LOW_BALANCE_THRESHOLD && <Badge tone="warning">Low</Badge>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Events</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{events.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cards scanned</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{cards.length}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Events</h2>
        <TableCard>
          <TableHeaderRow>
            <Th>Name</Th>
            <Th align="right">Cards</Th>
            <Th align="right">Created</Th>
          </TableHeaderRow>
          {events.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted">No events yet.</p>}
          {events.map((event) => (
            <Tr key={event.id}>
              <Td>
                <Link href={`/events/${event.id}`} className="text-ink hover:underline">
                  {event.name}
                </Link>
              </Td>
              <Td align="right">{event.cardCount}</Td>
              <Td align="right">{formatDate(event.created_at)}</Td>
            </Tr>
          ))}
        </TableCard>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Cards</h2>
        <TableCard>
          <TableHeaderRow>
            <Th>Name</Th>
            <Th>Company</Th>
            <Th>Channel</Th>
            <Th align="right">Confidence</Th>
            <Th align="right">Scanned</Th>
          </TableHeaderRow>
          {cards.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted">No cards yet.</p>}
          {cards.map((card) => (
            <Tr key={card.id}>
              <Td className="font-medium text-ink">{card.full_name || "—"}</Td>
              <Td>{card.company_name || "—"}</Td>
              <Td className="capitalize">{card.uploaded_by || "—"}</Td>
              <Td align="right">
                {card.extraction_confidence !== null ? `${Math.round(card.extraction_confidence * 100)}%` : "—"}
              </Td>
              <Td align="right">{formatDateTime(card.created_at)}</Td>
            </Tr>
          ))}
        </TableCard>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent transactions</h2>
        <TableCard>
          <TableHeaderRow>
            <Th>Type</Th>
            <Th align="right">Coins</Th>
            <Th>Status</Th>
            <Th align="right">Date</Th>
          </TableHeaderRow>
          {transactions.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-muted">No transactions yet.</p>
          )}
          {transactions.map((tx) => (
            <Tr key={tx.id}>
              <Td className="capitalize">{tx.type.replace(/_/g, " ")}</Td>
              <Td align="right" className={tx.coins < 0 ? "text-danger-text" : "text-success-text"}>
                {tx.coins > 0 ? `+${tx.coins}` : tx.coins}
              </Td>
              <Td className="capitalize">{tx.status}</Td>
              <Td align="right">{formatDate(tx.created_at)}</Td>
            </Tr>
          ))}
        </TableCard>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Interaction history</h2>
        <TableCard>
          {interactionHistory.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-muted">No activity yet.</p>
          )}
          {interactionHistory.map((event, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-6 py-3.5 last:border-b-0"
            >
              {event.kind === "scan" ? (
                <ScanLine className="size-4 shrink-0 text-accent" strokeWidth={2} />
              ) : (
                <Bell className="size-4 shrink-0 text-muted" strokeWidth={2} />
              )}
              <p className="flex-1 text-sm text-ink">
                {event.kind === "scan"
                  ? `Scanned "${event.cardName || "a card"}"${event.channel ? ` via ${event.channel}` : ""}`
                  : `${NOTIFICATION_LABELS[event.notificationType ?? ""] ?? "Notification"} sent (${event.notificationStatus})`}
              </p>
              <span className="shrink-0 text-xs text-muted">{formatDate(event.at)}</span>
            </div>
          ))}
        </TableCard>
      </section>
    </div>
  );
}

const NOTIFICATION_LABELS: Record<string, string> = {
  renewal_reminder: "Renewal reminder",
  low_balance_alert: "Low balance alert",
};
