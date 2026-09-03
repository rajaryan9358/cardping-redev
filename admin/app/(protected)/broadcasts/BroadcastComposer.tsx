"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { TemplatePicker, TemplateMessagePreview, SlotRow, HeaderMediaLinkInput } from "../../../components/broadcasts/TemplateSlots";
import { AUDIENCE_FILTER_LABELS, AudienceFilter } from "../../../lib/audienceFilter";
import { BROADCAST_FIELD_OPTIONS, BroadcastField, SlotValue } from "../../../lib/broadcastFields";
import { WhatsAppTemplate } from "../../../lib/whatsappTemplates";
import { listWhatsAppTemplatesAction } from "../actions";
import { createAndSendBroadcastAction, CreateBroadcastState } from "./actions";

const initialState: CreateBroadcastState = { error: null };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Send broadcast
    </Button>
  );
}

export function BroadcastComposer() {
  const [channel, setChannel] = useState<"whatsapp" | "telegram">("whatsapp");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [manualTemplateName, setManualTemplateName] = useState("");
  const [manualLanguage, setManualLanguage] = useState("en");
  const [slots, setSlots] = useState<SlotValue[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [manualVariables, setManualVariables] = useState("");
  const [message, setMessage] = useState("");
  const [state, formAction] = useFormState(createAndSendBroadcastAction, initialState);

  useEffect(() => {
    if (channel === "whatsapp" && templates === null) {
      listWhatsAppTemplatesAction().then(setTemplates);
    }
  }, [channel, templates]);

  const usingDropdown = (templates?.length ?? 0) > 0;
  const templateName = usingDropdown ? selectedTemplate?.name ?? "" : manualTemplateName;
  const languageCode = usingDropdown ? selectedTemplate?.language ?? "en" : manualLanguage;

  function selectTemplate(t: WhatsAppTemplate | null) {
    setSelectedTemplate(t);
    setSlots(t ? Array.from({ length: t.variableCount }, () => ({ type: "literal", value: "" })) : []);
    setHeaderMediaUrl("");
  }

  function updateSlot(index: number, next: SlotValue) {
    setSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  function insertTelegramField(field: BroadcastField) {
    setMessage((prev) => `${prev}{{${field}}}`);
  }

  // Manual-template fallback (Meta returned no approved templates — no
  // known slot count) keeps the original one-line-per-variable behavior,
  // just wrapped into literal slots at submit time instead of a raw
  // string[], so createAndSendBroadcastAction only ever has one shape to
  // parse.
  const slotsToSubmit: SlotValue[] = usingDropdown
    ? slots
    : manualVariables
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((value) => ({ type: "literal", value }));

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex gap-2">
        {(["whatsapp", "telegram"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
              channel === c ? "bg-accent text-white" : "bg-active-bg text-muted-2"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="templateName" value={templateName} />
      <input type="hidden" name="languageCode" value={languageCode} />
      <input type="hidden" name="slots" value={JSON.stringify(slotsToSubmit)} />
      {/* Only known when picked from the Meta-backed dropdown — the manual-
          entry fallback has no way to know a template's body text, so
          recipients of that campaign always go through the formal
          template send regardless of their 24h window (see broadcastJob.ts). */}
      <input type="hidden" name="bodyText" value={usingDropdown ? selectedTemplate?.bodyText ?? "" : ""} />
      <input type="hidden" name="headerMediaFormat" value={usingDropdown ? selectedTemplate?.headerMediaFormat ?? "" : ""} />
      <input type="hidden" name="headerMediaUrl" value={headerMediaUrl} />

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold tracking-wide text-muted-2">Audience</label>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value as AudienceFilter)}
          className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
        >
          {(Object.keys(AUDIENCE_FILTER_LABELS) as AudienceFilter[]).map((f) => (
            <option key={f} value={f}>
              {AUDIENCE_FILTER_LABELS[f]}
            </option>
          ))}
        </select>
        <input type="hidden" name="audienceFilter" value={audienceFilter} />
        {audienceFilter === "contacted_never_signed_up" ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-text">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            Bypasses marketing opt-in — one-time &quot;finish signing up&quot; nudge only, not general marketing.
          </p>
        ) : (
          <p className="text-xs text-muted">Only opted-in, unblocked users.</p>
        )}
      </div>

      {channel === "whatsapp" ? (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Template</label>
            {templates === null ? (
              <p className="text-sm text-muted">Loading templates…</p>
            ) : usingDropdown ? (
              <TemplatePicker templates={templates} selected={selectedTemplate} onSelect={selectTemplate} />
            ) : (
              <>
                <p className="text-xs text-muted">No templates found — enter one manually.</p>
                <TextField
                  label="Template name"
                  value={manualTemplateName}
                  onChange={(e) => setManualTemplateName(e.target.value)}
                  placeholder="e.g. monthly_promo"
                />
                <TextField
                  label="Language code"
                  value={manualLanguage}
                  onChange={(e) => setManualLanguage(e.target.value)}
                />
              </>
            )}
          </div>

          {usingDropdown && selectedTemplate ? (
            <div className="flex flex-col gap-3">
              {selectedTemplate.headerMediaFormat && (
                <HeaderMediaLinkInput format={selectedTemplate.headerMediaFormat} value={headerMediaUrl} onChange={setHeaderMediaUrl} />
              )}
              {slots.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold tracking-wide text-muted-2">Variables</label>
                  {slots.map((slot, i) => (
                    <SlotRow key={i} index={i} slot={slot} onChange={(next) => updateSlot(i, next)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">This template has no variables.</p>
              )}
              {selectedTemplate.bodyText && <TemplateMessagePreview bodyText={selectedTemplate.bodyText} slots={slots} />}
            </div>
          ) : (
            !usingDropdown && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wide text-muted-2">
                  Body variables (one per line, in template order)
                </label>
                <textarea
                  value={manualVariables}
                  onChange={(e) => setManualVariables(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder={"e.g.\nJohn\n20% off this week"}
                />
              </div>
            )
          )}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Message</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) insertTelegramField(e.target.value as BroadcastField);
              }}
              className="rounded-lg border border-border bg-surface-warm px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">Insert field…</option>
              {BROADCAST_FIELD_OPTIONS.filter((opt) => !opt.whatsappOnly).map((opt) => (
                <option key={opt.field} value={opt.field}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            placeholder="Write a message…"
          />
        </div>
      )}

      {state.error && <p className="text-sm text-danger-text">{state.error}</p>}
      <div>
        <SendButton />
      </div>
    </form>
  );
}
