"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonLabel =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${selected.length} ${label} selected`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2 text-sm focus:outline-none",
          selected.length > 0 ? "border-accent text-accent-text" : "border-border text-ink",
        )}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-64 w-56 overflow-auto rounded-lg border border-border bg-surface py-1 shadow-xl">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs font-semibold text-accent hover:bg-active-bg"
            >
              Clear selection
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-active-bg"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  selected.includes(opt.value) ? "border-accent bg-accent text-white" : "border-border",
                )}
              >
                {selected.includes(opt.value) && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
          {options.length === 0 && <div className="px-3 py-2 text-xs text-muted">No options</div>}
        </div>
      )}
    </div>
  );
}
