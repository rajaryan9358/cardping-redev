"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { updateCardAction, CardFieldsPatch } from "./actions";

export interface EditCardTarget {
  id: string;
  full_name: string | null;
  position: string | null;
  company_name: string | null;
  business_email: string | null;
  personal_email: string | null;
  phone1: string | null;
  phone2: string | null;
  website: string | null;
  address: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  qr_code_content: string | null;
  additional_info: string | null;
}

// multiline fields can hold more than one value, one per line — a card can
// have more than one phone/email/website/address (see
// server/db/2026-08-27_card_multi_value_fields.sql). "list" fields render
// as a dynamic add/remove row of boxes; "multiline" stays a plain textarea
// (free-form text, not a set of discrete values).
const FIELDS: { key: keyof CardFieldsPatch; label: string; multiline?: boolean; list?: boolean }[] = [
  { key: "full_name", label: "Full name" },
  { key: "position", label: "Job title" },
  { key: "company_name", label: "Company" },
  { key: "business_email", label: "Business email(s)", list: true },
  { key: "personal_email", label: "Personal email(s)", list: true },
  { key: "phone1", label: "Phone(s)", list: true },
  { key: "phone2", label: "Phone (legacy)" },
  { key: "website", label: "Website(s)", list: true },
  { key: "address", label: "Address(es)", list: true },
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "qr_code_content", label: "QR code content" },
  { key: "additional_info", label: "Additional info", multiline: true },
];

// Dynamic add/remove list of boxes for a repeatable field, backed by the
// same newline-joined string the rest of the form's `values` state uses —
// splits to edit, rejoins on every change so the parent stays the single
// source of truth for the eventual patch.
function MultiValueRows({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const displayRows = value.split("\n");

  function setRow(i: number, v: string) {
    const next = [...displayRows];
    next[i] = v;
    onChange(next.join("\n"));
  }
  function removeRow(i: number) {
    const next = displayRows.length > 1 ? displayRows.filter((_, idx) => idx !== i) : [""];
    onChange(next.join("\n"));
  }
  function addRow() {
    onChange([...displayRows, ""].join("\n"));
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <label className="text-xs font-semibold tracking-wide text-muted-2">{label}</label>
      <div className="flex flex-col gap-2">
        {displayRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row}
              onChange={(e) => setRow(i, e.target.value)}
              placeholder={i === 0 ? "Primary" : "Additional"}
              className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-danger-text hover:text-danger-text"
              aria-label={`Remove ${label} value`}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:underline">
        <Plus className="size-3.5" strokeWidth={2} />
        Add another
      </button>
    </div>
  );
}

export function EditCardModal({ target, onClose }: { target: EditCardTarget | null; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      const next: Record<string, string> = {};
      for (const f of FIELDS) next[f.key] = (target[f.key as keyof EditCardTarget] as string | null) ?? "";
      setValues(next);
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: CardFieldsPatch = {};
      for (const f of FIELDS) {
        const raw = values[f.key] ?? "";
        patch[f.key] = f.list
          ? raw.split("\n").map((v) => v.trim()).filter((v) => v.length > 0).join("\n") || null
          : raw || null;
      }
      await updateCardAction(target!.id, patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="Edit card"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) =>
          f.list ? (
            <MultiValueRows
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(next) => setValues((v) => ({ ...v, [f.key]: next }))}
            />
          ) : f.multiline ? (
            <div key={f.key} className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-xs font-semibold tracking-wide text-muted-2">{f.label}</label>
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          ),
        )}
      </div>
      {error && <p className="mt-4 text-sm text-danger-text">{error}</p>}
    </Modal>
  );
}
