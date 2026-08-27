"use client";

import { useState } from "react";
import { EarningsModal } from "./EarningsModal";

export function EarningsStatCard({ value }: { value: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border bg-surface p-6 text-left shadow-soft transition-colors hover:border-accent"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total earning</p>
        <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      </button>
      <EarningsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
