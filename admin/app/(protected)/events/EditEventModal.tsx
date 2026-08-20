"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { updateEventAction, EventPatch } from "./actions";

export interface EditEventTarget {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  status: "active" | "inactive";
}

export function EditEventModal({ target, onClose }: { target: EditEventTarget | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setLocation(target.location ?? "");
      setEventDate(target.event_date ?? "");
      setStatus(target.status);
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter an event name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: EventPatch = { name, location: location || null, event_date: eventDate || null, status };
      await updateEventAction(target!.id, patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Edit event"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Event name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" />
        <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location / venue" />
        <TextField label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Active</p>
            <p className="text-xs text-muted">Inactive events are hidden from event pickers.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={status === "active"}
            onClick={() => setStatus((v) => (v === "active" ? "inactive" : "active"))}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${status === "active" ? "bg-accent" : "bg-border"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform ${status === "active" ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
