"use client";

import { Calendar, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/cn";
import { EventRecord } from "@/lib/types";

type FilterTab = "all" | "active" | "upcoming" | "inactive";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "inactive", label: "Inactive" },
];

const STATUS_BADGE: Record<EventRecord["status"], { label: string; tone: "success" | "pending" | "accent" }> = {
  active: { label: "Active", tone: "success" },
  upcoming: { label: "Upcoming", tone: "accent" },
  past: { label: "Past", tone: "pending" },
  draft: { label: "Draft", tone: "pending" },
};

function matchesTab(status: EventRecord["status"], tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "inactive") return status === "past" || status === "draft";
  return status === tab;
}

export function EventsClient({ events }: { events: EventRecord[] }) {
  const [tab, setTab] = useState<FilterTab>("all");
  const named = events.filter((e) => !e.isMiscellaneous);
  const totalLeads = events.reduce((sum, e) => sum + e.leadCount, 0);
  const filtered = named.filter((e) => matchesTab(e.status, tab));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Events Overview</h1>
          <p className="text-sm text-muted">Manage your lead generation campaigns and event tracking.</p>
        </div>
        <Link href="/events/new">
          <Button className="gap-2">
            <Plus className="size-4" strokeWidth={2.25} /> Create New Event
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <StatCard label="Total Events" value={named.length} icon={Calendar} />
        <StatCard label="Active Now" value={named.filter((e) => e.status === "active").length} icon={Users} />
        <StatCard label="Total Leads Captured" value={totalLeads.toLocaleString()} icon={Users} />
      </div>

      <div className="flex gap-1 rounded-lg bg-active-bg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {filtered.map((event) => {
          const badge = STATUS_BADGE[event.status];
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <div className="relative flex h-28 items-center justify-center bg-accent-soft">
                <span className="absolute right-3 top-3">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </span>
                <span className="text-2xl font-semibold text-accent">{event.name[0]}</span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <h3 className="font-medium text-ink">{event.name}</h3>
                {event.eventDate && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar className="size-3.5" strokeWidth={2} />
                    {new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {event.location && (
                      <>
                        <MapPin className="ml-1 size-3.5" strokeWidth={2} />
                        {event.location}
                      </>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted">
                  Leads Captured <span className="font-semibold text-ink">{event.leadCount}</span>
                </p>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <p className="col-span-3 py-12 text-center text-sm text-muted">No events in this view yet.</p>}
      </div>
    </div>
  );
}
