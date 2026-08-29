"use client";

import { BROADCAST_FIELD_OPTIONS, BroadcastField, SlotValue } from "../../lib/broadcastFields";

const CUSTOM_TEXT_OPTION = "__custom_text__";

/** Splits a template's body on its {{n}} slots and highlights each one, so
 * the admin can see exactly where a mapped field lands in context instead
 * of mapping slots blind. Shared by BroadcastComposer and SendMessageModal
 * so both present the identical UI for the identical underlying data. */
export function TemplateBodyPreview({ bodyText }: { bodyText: string }) {
  const parts = bodyText.split(/(\{\{\d+\}\})/g);
  return (
    <p className="whitespace-pre-line rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink">
      {parts.map((part, i) => {
        const match = part.match(/^\{\{(\d+)\}\}$/);
        if (!match) return <span key={i}>{part}</span>;
        return (
          <mark key={i} className="rounded bg-accent-soft px-1 py-0.5 font-medium text-accent-text">
            Slot {match[1]}
          </mark>
        );
      })}
    </p>
  );
}

export function SlotRow({ index, slot, onChange }: { index: number; slot: SlotValue; onChange: (next: SlotValue) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-2">Slot {index + 1}</span>
      <select
        value={slot.type === "field" ? slot.field : CUSTOM_TEXT_OPTION}
        onChange={(e) => {
          const value = e.target.value;
          onChange(value === CUSTOM_TEXT_OPTION ? { type: "literal", value: "" } : { type: "field", field: value as BroadcastField });
        }}
        className="shrink-0 rounded-lg border border-border bg-surface-warm px-2.5 py-2 text-sm text-ink"
      >
        <option value={CUSTOM_TEXT_OPTION}>Custom text</option>
        {BROADCAST_FIELD_OPTIONS.map((opt) => (
          <option key={opt.field} value={opt.field}>
            {opt.label}
          </option>
        ))}
      </select>
      {slot.type === "literal" && (
        <input
          value={slot.value}
          onChange={(e) => onChange({ type: "literal", value: e.target.value })}
          placeholder="Text for this slot"
          className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      )}
    </div>
  );
}
