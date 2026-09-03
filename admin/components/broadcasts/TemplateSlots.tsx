"use client";

import { AlertTriangle, Check } from "lucide-react";
import { TextField } from "../ui/TextField";
import { BROADCAST_FIELD_OPTIONS, BroadcastField, SlotValue, HeaderMediaFormat } from "../../lib/broadcastFields";
import { WhatsAppTemplate } from "../../lib/whatsappTemplates";

const CUSTOM_TEXT_OPTION = "__custom_text__";

const HEADER_FORMAT_LABEL: Record<HeaderMediaFormat, string> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "document",
};

/** A media-header template (IMAGE/VIDEO/DOCUMENT) needs a real, publicly
 * reachable link on every single send — the example media submitted for
 * the template's approval is preview-only and never reused automatically.
 * Shared by every place a WhatsApp template gets picked (broadcast
 * composer, bulk-broadcast modal, single-recipient Send Message), so the
 * same required-field treatment shows up everywhere it's needed. */
export function HeaderMediaLinkInput({ format, value, onChange }: { format: HeaderMediaFormat; value: string; onChange: (next: string) => void }) {
  const label = HEADER_FORMAT_LABEL[format];
  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label={`Header ${label} URL`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`https://.../your-${label}`}
      />
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
        Required — this template's header is a {label}, and every send needs a real link here (the example you
        submitted for approval isn&apos;t reused automatically).
      </p>
    </div>
  );
}

/** Replaces a template picker `<select>` with a scannable grid of cards —
 * each shows the template's name and its actual body message, so the
 * admin can recognize the right one by content instead of by name alone.
 * Shared by BroadcastComposer, BroadcastToUsersModal and SendMessageModal,
 * every place templates come from Meta's approved-templates list. */
export function TemplatePicker({
  templates,
  selected,
  onSelect,
}: {
  templates: WhatsAppTemplate[];
  selected: WhatsAppTemplate | null;
  onSelect: (t: WhatsAppTemplate) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {templates.map((t) => {
        const isSelected = selected?.name === t.name && selected?.language === t.language;
        return (
          <button
            key={`${t.name}:${t.language}`}
            type="button"
            onClick={() => onSelect(t)}
            className={`relative flex flex-col gap-1.5 rounded-lg border px-3.5 py-3 text-left transition-colors ${
              isSelected ? "border-accent bg-accent-soft" : "border-border bg-surface-warm hover:border-accent/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{t.name}</span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-2">{t.language}</span>
            </div>
            <p className="line-clamp-2 text-xs text-muted">{t.bodyText || "No body text."}</p>
            {isSelected && (
              <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Renders the template's body with every {{n}} slot substituted for its
 * current mapping — a literal shows the admin's typed text, a field shows
 * a bracketed placeholder (e.g. "[Name]") since no single recipient is
 * known yet for a broadcast audience. Updates live as slots are edited, so
 * the admin can see roughly what recipients will receive before sending. */
export function TemplateMessagePreview({ bodyText, slots }: { bodyText: string; slots: SlotValue[] }) {
  const filled = bodyText.replace(/\{\{(\d+)\}\}/g, (match, num: string) => {
    const slot = slots[Number(num) - 1];
    if (!slot) return match;
    if (slot.type === "literal") return slot.value.trim() ? slot.value : match;
    const label = BROADCAST_FIELD_OPTIONS.find((opt) => opt.field === slot.field)?.label ?? slot.field;
    return `[${label}]`;
  });
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold tracking-wide text-muted-2">Preview</label>
      <p className="whitespace-pre-line rounded-2xl rounded-tl-sm border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink">
        {filled}
      </p>
    </div>
  );
}

export function SlotRow({ index, slot, onChange }: { index: number; slot: SlotValue; onChange: (next: SlotValue) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-2">Variable {index + 1}</span>
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
