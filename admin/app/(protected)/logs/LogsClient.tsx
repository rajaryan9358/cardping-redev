"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { TextField } from "../../../components/ui/TextField";
import { Badge } from "../../../components/ui/Badge";
import { cn } from "@/lib/cn";
import { LogEntry, LogProcessName } from "../../../lib/serverLogs";
import { formatDateTime } from "../../../lib/format";

const PROCESS_TABS: { value: LogProcessName; label: string }[] = [
  { value: "server", label: "Server" },
  { value: "dashboard", label: "Dashboard" },
  { value: "admin", label: "Admin" },
];

const LEVEL_TABS: { value: LogEntry["levelLabel"] | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "fatal", label: "Fatal" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "unknown", label: "Other" },
];

const LEVEL_BADGE: Record<LogEntry["levelLabel"], { label: string; tone: "danger" | "warning" | "accent" | "pending" }> = {
  fatal: { label: "FATAL", tone: "danger" },
  error: { label: "ERROR", tone: "danger" },
  warn: { label: "WARN", tone: "warning" },
  info: { label: "INFO", tone: "accent" },
  debug: { label: "DEBUG", tone: "pending" },
  trace: { label: "TRACE", tone: "pending" },
  unknown: { label: "—", tone: "pending" },
};

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const badge = LEVEL_BADGE[entry.levelLabel];

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-warm/60"
      >
        {open ? (
          <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={2} />
        ) : (
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={2} />
        )}
        <span className="w-36 shrink-0 text-xs text-muted">{entry.time ? formatDateTime(new Date(entry.time).toISOString()) : "—"}</span>
        <span className="w-16 shrink-0">
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </span>
        {entry.scope && <span className="w-32 shrink-0 truncate text-xs text-muted-2">{entry.scope}</span>}
        <span className="flex-1 truncate text-sm text-ink">{entry.msg}</span>
      </button>
      {open && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-surface-warm px-4 py-3 text-xs text-muted-2">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(entry.raw), null, 2);
            } catch {
              return entry.raw;
            }
          })()}
        </pre>
      )}
    </div>
  );
}

export function LogsClient({
  logs,
  process,
  error,
}: {
  logs: LogEntry[];
  process: LogProcessName;
  error: string | null;
}) {
  const [level, setLevel] = useState<LogEntry["levelLabel"] | "">("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((e) => {
      if (level && e.levelLabel !== level) return false;
      if (term && !e.msg.toLowerCase().includes(term) && !(e.scope ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [logs, level, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-warm p-1">
          {PROCESS_TABS.map((tab) => (
            // Hard <a>, not next/link: switching process needs a fresh
            // server-side tail read, and this app's navigation convention
            // (see admin/components/shell/Sidebar.tsx) always hard-navs
            // rather than risk the client Router Cache repainting a stale
            // batch of log lines.
            <a
              key={tab.value}
              href={`/admin/logs?process=${tab.value}`}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                process === tab.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </a>
          ))}
        </div>
        <a href={`/admin/logs?process=${process}`}>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-warm">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Refresh
          </span>
        </a>
      </div>

      {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-2">Level</span>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-warm p-1">
            {LEVEL_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => setLevel(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  level === tab.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-w-sm flex-1">
          <TextField label="Search" placeholder="Filter by message or scope…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="pb-2.5 text-xs text-muted">
          {filtered.length} of {logs.length} lines
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">No log lines match.</p>
        ) : (
          filtered.map((entry, i) => <LogRow key={i} entry={entry} />)
        )}
      </div>
    </div>
  );
}
