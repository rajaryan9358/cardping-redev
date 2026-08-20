"use client";

import { useEffect, useState } from "react";
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
}

const FIELDS: { key: keyof CardFieldsPatch; label: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "position", label: "Job title" },
  { key: "company_name", label: "Company" },
  { key: "business_email", label: "Business email" },
  { key: "personal_email", label: "Personal email" },
  { key: "phone1", label: "Phone 1" },
  { key: "phone2", label: "Phone 2" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
];

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
      for (const f of FIELDS) patch[f.key] = values[f.key] || null;
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
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-danger-text">{error}</p>}
    </Modal>
  );
}
