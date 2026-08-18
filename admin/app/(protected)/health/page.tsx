import { Activity, MessageCircle, Send } from "lucide-react";
import { adminHealthRepo } from "../../../lib/repositories/adminHealth.repo";
import { Badge } from "../../../components/ui/Badge";
import { ScanVolumeChart } from "./ScanVolumeChart";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function HealthPage() {
  const [lastScans, lastTransactions, volume, serverHealth] = await Promise.all([
    adminHealthRepo.getLastScanByChannel(),
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
        <p className="mt-2 text-xs text-muted">
          {serverHealth.ok
            ? `HTTP ${serverHealth.status} — ${JSON.stringify(serverHealth.body)}`
            : serverHealth.error}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {lastScans.map(({ channel, lastCard }) => (
          <div key={channel} className="rounded-xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center gap-2">
              {channel === "whatsapp" ? (
                <MessageCircle className="size-4 text-success-text" strokeWidth={2} />
              ) : (
                <Send className="size-4 text-accent" strokeWidth={2} />
              )}
              <p className="text-sm font-semibold capitalize text-ink">{channel} — last scan</p>
            </div>
            {lastCard ? (
              <p className="mt-2 text-sm text-muted-2">
                {lastCard.full_name || "Unnamed card"} · {timeAgo(lastCard.created_at)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">No scans yet.</p>
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
        <h2 className="mb-3 text-lg font-semibold text-ink">Most recent transaction by type</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lastTransactions.map(({ type, lastTransaction }) => (
            <div key={type} className="rounded-xl border border-border bg-surface p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {type.replace(/_/g, " ")}
              </p>
              {lastTransaction ? (
                <p className="mt-2 text-sm text-muted-2">
                  {lastTransaction.coins > 0 ? "+" : ""}
                  {lastTransaction.coins} coins · {timeAgo(lastTransaction.created_at)}
                </p>
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
