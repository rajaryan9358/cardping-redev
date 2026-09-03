"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { TemplatePicker, TemplateMessagePreview, SlotRow, HeaderMediaLinkInput } from "../../../components/broadcasts/TemplateSlots";
import { BROADCAST_FIELD_OPTIONS, BroadcastField, SlotValue } from "../../../lib/broadcastFields";
import { WhatsAppTemplate } from "../../../lib/whatsappTemplates";
import { ListUsersFilterParams } from "../../../lib/repositories/adminUsers.repo";
import { BroadcastChannel } from "../../../lib/repositories/adminBroadcasts.repo";
import { listWhatsAppTemplatesAction } from "../actions";
import { broadcastToUsersAction, BroadcastSource } from "./broadcastActions";

export function BroadcastToUsersModal({
  open,
  source,
  selectedIds,
  filters,
  onClose,
}: {
  open: boolean;
  source: BroadcastSource;
  selectedIds: string[];
  filters: ListUsersFilterParams;
  onClose: () => void;
}) {
  // Accounts can be linked on either/both channels, so the admin picks
  // which one to send on; a Contacts source already implies its channel.
  const fixedChannel: BroadcastChannel | null = source === "whatsapp_contacts" ? "whatsapp" : source === "telegram_contacts" ? "telegram" : null;
  const [channel, setChannel] = useState<BroadcastChannel>(fixedChannel ?? "whatsapp");
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [manualTemplateName, setManualTemplateName] = useState("");
  const [manualLanguage, setManualLanguage] = useState("en");
  const [slots, setSlots] = useState<SlotValue[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel(fixedChannel ?? "whatsapp");
    setSelectedTemplate(null);
    setSlots([]);
    setHeaderMediaUrl("");
    setMessage("");
    setError(null);
    setTemplates(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && channel === "whatsapp" && templates === null) {
      listWhatsAppTemplatesAction().then(setTemplates);
    }
  }, [open, channel, templates]);

  const usingDropdown = (templates?.length ?? 0) > 0;
  const templateName = usingDropdown ? selectedTemplate?.name ?? "" : manualTemplateName;
  const languageCode = usingDropdown ? selectedTemplate?.language ?? "en" : manualLanguage;
  const targetLabel = selectedIds.length > 0 ? `${selectedIds.length} selected` : "everyone matching your current filters";

  function selectTemplate(t: WhatsAppTemplate | null) {
    setSelectedTemplate(t);
    setSlots(t ? Array.from({ length: t.variableCount }, () => ({ type: "literal", value: "" })) : []);
    setHeaderMediaUrl("");
  }

  function updateSlot(index: number, next: SlotValue) {
    setSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  function insertField(field: BroadcastField) {
    setMessage((prev) => `${prev}{{${field}}}`);
  }

  async function handleSend() {
    setSaving(true);
    setError(null);
    try {
      const result = await broadcastToUsersAction({
        source,
        selectedIds,
        filters,
        channel,
        templateName: channel === "whatsapp" ? templateName || null : null,
        languageCode,
        slots: channel === "whatsapp" ? slots : undefined,
        bodyText: channel === "whatsapp" ? selectedTemplate?.bodyText ?? null : undefined,
        headerMediaFormat: channel === "whatsapp" ? selectedTemplate?.headerMediaFormat ?? null : undefined,
        headerMediaUrl: channel === "whatsapp" ? headerMediaUrl : undefined,
        message: channel === "telegram" ? message : undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast message"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} loading={saving}>
            Send to {selectedIds.length > 0 ? selectedIds.length : "filtered"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted">Sending to <span className="font-medium text-ink">{targetLabel}</span>.</p>

        {fixedChannel === null && (
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
        )}

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
                  <TextField label="Template name" value={manualTemplateName} onChange={(e) => setManualTemplateName(e.target.value)} placeholder="e.g. monthly_promo" />
                  <TextField label="Language code" value={manualLanguage} onChange={(e) => setManualLanguage(e.target.value)} />
                </>
              )}
            </div>

            {usingDropdown && selectedTemplate && (
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
                {selectedTemplate.bodyText && (
                  <TemplateMessagePreview bodyText={selectedTemplate.bodyText} slots={slots} headerMediaFormat={selectedTemplate.headerMediaFormat} />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wide text-muted-2">Message</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) insertField(e.target.value as BroadcastField);
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
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="Write a message…"
            />
          </div>
        )}

        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
