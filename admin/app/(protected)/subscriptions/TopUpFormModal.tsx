"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { TopUpCatalogRow, TopUpInput } from "../../../lib/repositories/adminSubscriptions.repo";
import { createTopUpAction, updateTopUpAction } from "./actions";

const EMPTY: TopUpInput = { coins: 0, price_inr: 0, description: "", benefits: [], is_popular: false, tag: "", is_default: false };

export function TopUpFormModal({
  topUp,
  open,
  onClose,
}: {
  topUp: TopUpCatalogRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TopUpInput>(EMPTY);
  const [benefitsText, setBenefitsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (topUp) {
      setForm({
        coins: topUp.coins,
        price_inr: topUp.price_inr,
        description: topUp.description ?? "",
        benefits: topUp.benefits,
        is_popular: topUp.is_popular,
        tag: topUp.tag ?? "",
        is_default: topUp.is_default,
      });
      setBenefitsText(topUp.benefits.join("\n"));
    } else {
      setForm(EMPTY);
      setBenefitsText("");
    }
    setError(null);
  }, [open, topUp]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const input: TopUpInput = {
      ...form,
      benefits: benefitsText.split("\n").map((b) => b.trim()).filter(Boolean),
    };
    const result = topUp ? await updateTopUpAction(topUp.id, input) : await createTopUpAction(input);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={topUp ? `Edit ${topUp.coins}-credit top-up` : "Add top-up package"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Credits" type="number" value={form.coins} onChange={(e) => setForm({ ...form, coins: Number(e.target.value) })} />
          <TextField
            label="Price (₹)"
            type="number"
            value={form.price_inr}
            onChange={(e) => setForm({ ...form, price_inr: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.is_popular}
            onChange={(e) => setForm({ ...form, is_popular: e.target.checked })}
          />
          Mark as "Most popular"
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />
          Pre-select this package by default
        </label>
        <TextField
          label="Tag (optional)"
          placeholder='e.g. "Best Value"'
          value={form.tag}
          onChange={(e) => setForm({ ...form, tag: e.target.value })}
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Benefits (one per line)</label>
          <textarea
            value={benefitsText}
            onChange={(e) => setBenefitsText(e.target.value)}
            rows={3}
            placeholder={"e.g.\nNever expires\nInstant credit"}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
