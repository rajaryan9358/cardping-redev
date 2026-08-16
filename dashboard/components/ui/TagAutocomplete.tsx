"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { TagChip } from "./TagChip";

interface TagAutocompleteProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

/** Type to filter existing tags across the whole account, pick one from the
 * dropdown, or add whatever's typed as a brand-new tag. */
export function TagAutocomplete({ tags, onChange, suggestions }: TagAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions.filter((s) => !tags.includes(s) && (q === "" || s.toLowerCase().includes(q)));
  }, [suggestions, tags, query]);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setQuery("");
    setOpen(false);
  }

  const canCreate = query.trim() && !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagChip key={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))}>
            {tag}
          </TagChip>
        ))}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(query);
            }
          }}
          placeholder="Search or add a tag"
          className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
        />
        {open && (filtered.length > 0 || canCreate) && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => addTag(s)}
                className={cn("block w-full px-3 py-2 text-left text-xs text-ink hover:bg-active-bg")}
              >
                {s}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onMouseDown={() => addTag(query)}
                className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2 text-left text-xs text-accent hover:bg-accent-soft"
              >
                <Plus className="size-3.5" strokeWidth={2} /> Create &quot;{query.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
