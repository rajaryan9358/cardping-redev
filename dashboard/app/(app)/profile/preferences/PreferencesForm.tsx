"use client";

import { Megaphone, ScanLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Account } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const LIFETIME_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "Always", hours: null },
];

export function PreferencesForm({ account }: { account: Account }) {
  const [saved, setSavedState] = useState({
    scanBothSides: account.scanBothSides,
    eventLifetimeHours: account.eventLifetimeHours,
    marketingOptIn: account.marketingOptIn,
  });
  const [scanBothSides, setScanBothSides] = useState(saved.scanBothSides);
  const [eventLifetimeHours, setEventLifetimeHours] = useState<number | null>(saved.eventLifetimeHours);
  const [marketingOptIn, setMarketingOptIn] = useState(saved.marketingOptIn);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  const isDirty =
    scanBothSides !== saved.scanBothSides ||
    eventLifetimeHours !== saved.eventLifetimeHours ||
    marketingOptIn !== saved.marketingOptIn;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const [settingsRes, marketingRes] = await Promise.all([
        clientFetch("/api/account/settings", {
          method: "PATCH",
          body: JSON.stringify({ scanBothSides, eventLifetimeHours }),
        }),
        clientFetch("/api/account/settings/marketing-opt-in", {
          method: "PATCH",
          body: JSON.stringify({ marketingOptIn }),
        }),
      ]);
      await parseJsonOrThrow(settingsRes);
      await parseJsonOrThrow(marketingRes);
      setSavedState({ scanBothSides, eventLifetimeHours, marketingOptIn });
      showToast("Preferences saved successfully");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="flex items-center gap-2 pb-4 text-base font-semibold text-ink">
        <ScanLine className="size-4 text-accent" strokeWidth={2} /> Scanning
      </h2>
      {error && <p className="mb-4 max-w-sm rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Scan Both Sides</p>
            <p className="text-xs text-muted">Ask for a back-of-card photo on every scan and merge both sides.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={scanBothSides}
            onClick={() => setScanBothSides((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${scanBothSides ? "bg-accent" : "bg-border"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform ${scanBothSides ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="event-lifetime" className="text-xs font-semibold tracking-wide text-muted-2">
            Event Lifetime
          </label>
          <p className="text-xs text-muted">How long an active event stays selected before you're asked again.</p>
          <select
            id="event-lifetime"
            value={eventLifetimeHours ?? "always"}
            onChange={(e) => setEventLifetimeHours(e.target.value === "always" ? null : Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {LIFETIME_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.hours ?? "always"}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-border pt-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <Megaphone className="size-4 text-accent" strokeWidth={2} /> Marketing Updates
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Occasional offers and news</p>
              <p className="text-xs text-muted">Applies to every channel currently linked to your account.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={marketingOptIn}
              onClick={() => setMarketingOptIn((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${marketingOptIn ? "bg-accent" : "bg-border"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-soft transition-transform ${marketingOptIn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" className="self-start" loading={submitting} disabled={!isDirty}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}
