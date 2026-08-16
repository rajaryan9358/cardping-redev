"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { EventRecord } from "@/lib/types";

type EventType = "conference" | "networking" | "trade-show";
const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: "conference", label: "Conference" },
  { id: "networking", label: "Networking" },
  { id: "trade-show", label: "Trade Show" },
];

const EVENT_STATUSES: { id: EventRecord["status"]; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "past", label: "Past" },
];

export default function NewEventPage() {
  const router = useRouter();
  const [eventType, setEventType] = useState<EventType>("conference");
  const [status, setStatus] = useState<EventRecord["status"]>("upcoming");
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/events");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Create Event</h1>
        <p className="text-sm text-muted">Set up a new event for lead capture.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
        <div className="flex flex-col gap-2 pb-6">
          <label className="text-xs font-medium text-muted">Event Thumbnail</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center hover:border-accent hover:bg-accent-soft/30">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setThumbnailName(e.target.files?.[0]?.name ?? null)}
            />
            <Upload className="size-5 text-muted" strokeWidth={1.75} />
            <span className="text-sm text-ink">{thumbnailName ?? "Click to upload or drag and drop"}</span>
            <span className="text-xs text-muted">Recommended aspect ratio 16:9 (e.g., 1280x720px)</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              Event Name <span className="text-danger-text">*</span>
            </label>
            <input required placeholder="e.g., Annual Tech Summit" className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Location / Venue</label>
            <input placeholder="e.g., Moscone Center" className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              From Date <span className="text-danger-text">*</span>
            </label>
            <input required type="date" className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">To Date (Optional)</label>
            <input type="date" className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pb-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">Event Type</label>
            <div className="flex gap-6">
              {EVENT_TYPES.map((type) => (
                <label key={type.id} className="flex items-center gap-2 text-sm text-ink">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      eventType === type.id ? "border-accent" : "border-border",
                    )}
                  >
                    {eventType === type.id && <span className="size-2 rounded-full bg-accent" />}
                  </span>
                  <input
                    type="radio"
                    name="eventType"
                    className="hidden"
                    checked={eventType === type.id}
                    onChange={() => setEventType(type.id)}
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventRecord["status"])}
              className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {EVENT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Link href="/events">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit">Create Event</Button>
        </div>
      </form>
    </div>
  );
}
