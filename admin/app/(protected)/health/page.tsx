import { Activity, MessageCircle, Send } from "lucide-react";
import { adminHealthRepo } from "../../../lib/repositories/adminHealth.repo";
import { Badge } from "../../../components/ui/Badge";
import { formatUptime } from "../../../lib/format";
import { ScanVolumeChart } from "./ScanVolumeChart";

function serverStatusText(serverHealth: Awaited<ReturnType<typeof adminHealthRepo.pingServerHealth>>): string {
  if (!serverHealth.ok) return serverHealth.error ?? "Unreachable";
  const body = serverHealth.body as { uptimeSeconds?: unknown } | undefined;
  if (typeof body?.uptimeSeconds === "number") return `Reachable · up ${formatUptime(body.uptimeSeconds)}`;
  return "Reachable";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type LastTransaction = { coins: number; created_at: string; amount_inr: number | null };

/** card_scan's coins delta is always -1 — showing it added noise, not
 * information, so that tile is just a timestamp. subscription_payment
 * cares about the amount charged (amount_inr), not a coins delta,
 * which may not even be set on that row. Every other type still shows
 * its signed coins delta, same as before. */
function transactionSummary(type: string, txn: LastTransaction): string {
  if (type === "card_scan") return timeAgo(txn.created_at);
  if (type === "subscription_payment") {
    return txn.amount_inr != null ? `₹${txn.amount_inr} · ${timeAgo(txn.created_at)}` : timeAgo(txn.created_at);
  }
  return `${txn.coins > 0 ? "+" : ""}${txn.coins} credits · ${timeAgo(txn.created_at)}`;
}

export default async function HealthPage() {
  const [lastSeen, lastTransactions, volume, serverHealth] = await Promise.all([
    adminHealthRepo.getLastSeenByChannel(),
    adminHealthRepo.getLastTransactionByType(),
    adminHealthRepo.getScanVolumeByDay(14),
    adminHealthRepo.pingServerHealth(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Bot / Scan Health</h1>
        <p className="mt-1 text-sm text-muted">Live bot and scan activity.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted" strokeWidth={2} />
            <p className="text-sm font-semibold text-ink">Server</p>
          </div>
          {serverHealth.ok ? <Badge tone="success">Reachable</Badge> : <Badge tone="danger">Unreachable</Badge>}
        </div>
        <p className="mt-2 text-xs text-muted">{serverStatusText(serverHealth)}</p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {lastSeen.map(({ channel, lastSeenAt }) => (
          <div key={channel} className="rounded-xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center gap-2">
              {channel === "whatsapp" ? (
                <MessageCircle className="size-4 text-success-text" strokeWidth={2} />
              ) : (
                <Send className="size-4 text-accent" strokeWidth={2} />
              )}
              <p className="text-sm font-semibold capitalize text-ink">{channel} — last seen</p>
            </div>
            {/* Last inbound message from any identity on this channel (see
                adminHealth.repo.ts#getLastSeenByChannel) — a genuine
                connectivity signal, not just "last time a scan succeeded":
                someone can be actively using the bot (menu, events,
                billing) between scans. */}
            {lastSeenAt ? (
              <p className="mt-2 text-sm text-muted-2">{timeAgo(lastSeenAt)}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">No activity yet.</p>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Scan volume — last 14 days</h2>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
          <ScanVolumeChart data={volume} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Most recent activity by type</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lastTransactions.map(({ type, lastTransaction }) => (
            <div key={type} className="rounded-xl border border-border bg-surface p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {type.replace(/_/g, " ")}
              </p>
              {lastTransaction ? (
                <p className="mt-2 text-sm text-muted-2">{transactionSummary(type, lastTransaction)}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">None yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
