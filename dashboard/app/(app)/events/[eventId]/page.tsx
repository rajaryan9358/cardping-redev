import { notFound } from "next/navigation";
import { MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { ScansExplorer } from "@/components/scans/ScansExplorer";
import { allTags, getCards } from "@/lib/data/cards";
import { getEvent, getEvents } from "@/lib/data/events";

// This frame's own Figma draft drew a different sidebar — deliberately
// not reproduced; this page uses the canonical AppShell like every other
// authenticated page. The leads table is the same ScansExplorer Directory
// uses (same columns, checkbox, bulk actions), just scoped to this event.
export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const event = await getEvent(params.eventId);
  if (!event) notFound();
  const [leads, events] = await Promise.all([getCards({ eventId: event.id }), getEvents()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <span>Conference</span>
          <Badge tone={event.status === "active" ? "success" : "pending"}>{event.status}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{event.name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          {event.eventDate &&
            new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {event.location && (
            <>
              <MapPin className="ml-1 size-3.5" strokeWidth={2} /> {event.location}
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard label="Total Leads" value={leads.length} icon={Users} />
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-accent-soft text-sm text-accent-text sm:col-span-2">
          Map preview
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink">Event Leads</h2>
      <ScansExplorer initialCards={leads} events={events} allTags={allTags(leads)} showEventFilter={false} pageSize={6} />
    </div>
  );
}
