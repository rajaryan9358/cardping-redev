"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

/** A single, consistent visual language for every secondary filter in a
 * table toolbar — collapsed to a labeled button showing its current value
 * (or nothing, when unset), expanding into a popover for the actual
 * control. Replaces a toolbar that mixes pills/selects/checkboxes/raw
 * inputs, all permanently expanded, with one predictable pattern: closed
 * by default, visually distinct (accent-tinted) the moment it's active,
 * and clearable without opening it. The clear "×" is a sibling button, not
 * nested inside the trigger — nested interactive elements are invalid
 * markup and break keyboard/screen-reader navigation. */
export function FilterPopover({
  label,
  value,
  onClear,
  children,
  align = "left",
}: {
  label: string;
  /** Current value's display text, or null/undefined when unset — drives
   * both the inline summary and the active (accent) styling. */
  value?: string | null;
  onClear?: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!value;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          active ? "rounded-r-none border-accent bg-accent-soft text-accent-text" : "border-border bg-surface-warm text-ink hover:border-accent/40",
        )}
      >
        {label}
        {active && <span className="font-normal">: {value}</span>}
        <ChevronDown className={cn("size-3.5 opacity-60 transition-transform", open && "rotate-180")} strokeWidth={2} />
      </button>
      {active && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="flex items-center rounded-r-lg border border-l-0 border-accent bg-accent-soft px-2 text-accent-text hover:bg-accent/15"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      )}
      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-2 w-72 rounded-xl border border-border bg-surface p-4 shadow-soft",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A clickable row inside a FilterPopover's panel — for a small set of
 * mutually-exclusive options (Plan, 24h window) where a plain list reads
 * faster than a native <select> and closes itself on pick. */
export function FilterOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
        selected ? "bg-accent-soft font-medium text-accent-text" : "text-ink hover:bg-active-bg",
      )}
    >
      {label}
    </button>
  );
}
