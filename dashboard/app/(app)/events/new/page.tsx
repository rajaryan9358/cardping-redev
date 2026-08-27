"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LocationAutocompleteInput } from "@/components/events/LocationAutocompleteInput";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const ERROR_MESSAGES: Record<string, string> = {
  no_channel_linked: "Connect WhatsApp or Telegram first — events organize scans, which only come in through a linked channel.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Couldn't create the event. Please try again.";
}

export default function NewEventPage() {
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

    setSubmitting(true);
    try {
      const res = await clientFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({ name, location, lat, lng, eventDate }),
      });
      const { event } = await parseJsonOrThrow<{ event: { id: string } }>(res);

      const thumbnailFile = fileInputRef.current?.files?.[0];
      if (thumbnailFile) {
        const uploadForm = new FormData();
        uploadForm.append("thumbnail", thumbnailFile);
        await fetch(`/api/events/${event.id}/thumbnail`, { method: "POST", credentials: "include", body: uploadForm });
      }

      // Hard navigation: a soft push to /events here would repaint the
      // client Router Cache's last snapshot of that list — missing the
      // event just created — before a refresh could correct it.
      window.location.href = "/events";
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Create Event</h1>
        <p className="text-sm text-muted">Set up a new event for lead capture.</p>
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
              placeholder="e.g., Annual Tech Summit"
              className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Location / Venue</label>
            <LocationAutocompleteInput />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Date</label>
            <input
              name="eventDate"
              type="date"
              className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Link href="/events">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>Create Event</Button>
        </div>
      </form>
    </div>
  );
}
