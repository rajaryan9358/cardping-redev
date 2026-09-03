"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TemplatePicker, TemplateMessagePreview, SlotRow, HeaderMediaLinkInput } from "../../../components/broadcasts/TemplateSlots";
import { SlotValue } from "../../../lib/broadcastFields";
import { WhatsAppTemplate } from "../../../lib/whatsappTemplates";
import { formatDate } from "../../../lib/format";
import { listWhatsAppTemplatesAction } from "../actions";
import { sendMessageAction } from "./actions";

const WITHIN_24H_MS = 24 * 60 * 60 * 1000;

export interface SendMessageTarget {
  user_id: string;
  full_name: string | null;
  wa_id: string | null;
  telegram_chat_id: string | null;
  last_login: string | null;
  effective_plan_expires_at: string | null;
}

function defaultMessageFor(user: SendMessageTarget): string {
  if (!user.effective_plan_expires_at) return "";
  const name = user.full_name || "there";
  return `Hi ${name}, your plan expires on ${formatDate(user.effective_plan_expires_at)}. Renew soon to keep your benefits.`;
}

export function SendMessageModal({ user, onClose }: { user: SendMessageTarget | null; onClose: () => void }) {
  const availableChannels = user
    ? ([user.wa_id ? "whatsapp" : null, user.telegram_chat_id ? "telegram" : null].filter(Boolean) as (
        | "whatsapp"
        | "telegram"
      )[])
    : [];
  const [channel, setChannel] = useState<"whatsapp" | "telegram">("whatsapp");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [slots, setSlots] = useState<SlotValue[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [manualTemplate, setManualTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const within24h = user?.last_login ? Date.now() - new Date(user.last_login).getTime() < WITHIN_24H_MS : false;
  const needsTemplate = channel === "whatsapp" && !within24h;
  const usingDropdown = (templates?.length ?? 0) > 0;

  useEffect(() => {
    if (!user) return;
    setChannel(availableChannels[0] ?? "whatsapp");
    setBody(defaultMessageFor(user));
    setError(null);
    setTemplates(null);
    setSelectedTemplate(null);
    setSlots([]);
    setHeaderMediaUrl("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  useEffect(() => {
    if (needsTemplate && templates === null) {
      listWhatsAppTemplatesAction().then(setTemplates);
    }
  }, [needsTemplate, templates]);

  if (!user) return null;

  function selectTemplate(t: WhatsAppTemplate | null) {
    setSelectedTemplate(t);
    setSlots(t ? Array.from({ length: t.variableCount }, () => ({ type: "literal", value: "" })) : []);
    setHeaderMediaUrl("");
  }

  function updateSlot(index: number, next: SlotValue) {
    setSlots((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  async function handleSend() {
    setSaving(true);
    setError(null);
    try {
      await sendMessageAction(user!.user_id, {
        channel,
        body: needsTemplate ? undefined : body,
        templateName: needsTemplate ? (usingDropdown ? selectedTemplate?.name : manualTemplate) : undefined,
        languageCode: selectedTemplate?.language,
        slots: needsTemplate && usingDropdown ? slots : undefined,
        headerMediaFormat: needsTemplate && usingDropdown ? selectedTemplate?.headerMediaFormat ?? null : undefined,
        headerMediaUrl: needsTemplate && usingDropdown ? headerMediaUrl : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={`Message ${user.full_name || "this user"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} loading={saving}>
            Send
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {availableChannels.length > 1 && (
          <div className="flex gap-2">
            {availableChannels.map((c) => (
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

        {needsTemplate ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">Outside the 24h window — pick a template.</p>
              <label className="text-xs font-semibold tracking-wide text-muted-2">Template</label>
              {templates === null ? (
                <p className="text-sm text-muted">Loading templates…</p>
              ) : usingDropdown ? (
                <TemplatePicker templates={templates} selected={selectedTemplate} onSelect={selectTemplate} />
              ) : (
                <>
                  <p className="text-xs text-muted">No templates found — enter the name manually.</p>
                  <input
                    value={manualTemplate}
                    onChange={(e) => setManualTemplate(e.target.value)}
                    placeholder="e.g. general_follow_up"
                    className="rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
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
                {selectedTemplate.bodyText && <TemplateMessagePreview bodyText={selectedTemplate.bodyText} slots={slots} />}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write a message…"
              className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        )}

        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
