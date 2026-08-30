"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Th } from "./Table";
import { parseSort } from "@/lib/sort";

export function SortableTh({
  field,
  label,
  currentSort,
  onSort,
  align,
  className,
}: {
  field: string;
  label: string;
  currentSort: string | undefined;
  onSort: (field: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const parsed = parseSort(currentSort);
  const active = parsed?.field === field;

  return (
    <Th align={align} className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 text-muted transition-colors hover:text-ink"
      >
        {label}
        {active ? (
          parsed!.ascending ? (
            <ChevronUp className="size-3" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="size-3" strokeWidth={2.5} />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" strokeWidth={2} />
        )}
      </button>
    </Th>
  );
}
