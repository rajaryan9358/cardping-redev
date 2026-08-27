"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LocationAutocompleteInput } from "@/components/events/LocationAutocompleteInput";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";
import { EventRecord } from "@/lib/types";

export function EditEventClient({ event }: { event: EventRecord }) {
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState(event.activeStatus);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const location = (form.get("location") as string) || null;
    const lat = form.get("lat") ? Number(form.get("lat")) : null;
    const lng = form.get("lng") ? Number(form.get("lng")) : null;
    const eventDate = (form.get("eventDate") as string) || null;

    setSaving(true);
    try {
      await clientFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, location, lat, lng, eventDate, status: activeStatus }),
      });

      const thumbnailFile = fileInputRef.current?.files?.[0];
      if (thumbnailFile) {
        const uploadForm = new FormData();
        uploadForm.append("thumbnail", thumbnailFile);
        await fetch(`/api/events/${event.id}/thumbnail`, { method: "POST", credentials: "include", body: uploadForm });
      }

      // Hard navigation: a soft push here would repaint the client Router
      // Cache's pre-edit snapshot of the event page before a refresh could
      // correct it.
      window.location.href = `/events/${event.id}`;
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Edit Event</h1>
        <p className="text-sm text-muted">Update this event's details.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
        {error && <p className="mb-6 rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

        <div className="flex flex-col gap-2 pb-6">
          <label className="text-xs font-medium text-muted">Event Thumbnail</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center hover:border-accent hover:bg-accent-soft/30">
            <input
              ref={fileInputRef}
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

        <div className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">
              Event Name <span className="text-danger-text">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={event.name}
              placeholder="e.g., Annual Tech Summit"
              className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Location / Venue</label>
            <LocationAutocompleteInput defaultValue={event.location} defaultLat={event.lat} defaultLng={event.lng} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Date</label>
            <input
              name="eventDate"
              type="date"
              defaultValue={event.eventDate ?? ""}
              className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-6 pb-6">
          <div>
            <p className="text-sm font-medium text-ink">Active</p>
            <p className="text-xs text-muted">Inactive events are hidden from the Change Event picker in WhatsApp/Telegram.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={activeStatus === "active"}
            onClick={() => setActiveStatus((v) => (v === "active" ? "inactive" : "active"))}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${activeStatus === "active" ? "bg-accent" : "bg-border"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform ${activeStatus === "active" ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Link href={`/events/${event.id}`}>
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
