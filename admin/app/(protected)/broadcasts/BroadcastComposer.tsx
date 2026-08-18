"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { AUDIENCE_FILTER_LABELS, AudienceFilter } from "../../../lib/audienceFilter";
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
  const [state, formAction] = useFormState(createAndSendBroadcastAction, initialState);

  useEffect(() => {
    if (channel === "whatsapp" && templates === null) {
      listWhatsAppTemplatesAction().then(setTemplates);
    }
  }, [channel, templates]);

  const usingDropdown = (templates?.length ?? 0) > 0;
  const templateName = usingDropdown ? selectedTemplate?.name ?? "" : manualTemplateName;
  const languageCode = usingDropdown ? selectedTemplate?.language ?? "en" : manualLanguage;

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
        <p className="text-xs text-muted">Only opted-in, unblocked users.</p>
      </div>

      {channel === "whatsapp" ? (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Template</label>
            {templates === null ? (
              <p className="text-sm text-muted">Loading templates…</p>
            ) : usingDropdown ? (
              <select
                value={selectedTemplate ? `${selectedTemplate.name}:${selectedTemplate.language}` : ""}
                onChange={(e) => {
                  const t = templates.find((tpl) => `${tpl.name}:${tpl.language}` === e.target.value);
                  setSelectedTemplate(t ?? null);
                }}
                className="rounded-lg border border-border bg-surface-warm px-3 py-2 text-sm text-ink"
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={`${t.name}:${t.language}`} value={`${t.name}:${t.language}`}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
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
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">
              Body variables (one per line, in template order)
            </label>
            <textarea
              name="variables"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder={"e.g.\nJohn\n20% off this week"}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Message</label>
          <textarea
            name="message"
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
