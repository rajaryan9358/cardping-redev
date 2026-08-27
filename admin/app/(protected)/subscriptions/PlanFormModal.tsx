"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { PlanCatalogRow, PlanInput } from "../../../lib/repositories/adminSubscriptions.repo";
import { createPlanAction, updatePlanAction } from "./actions";

const EMPTY: PlanInput = {
  name: "",
  price_inr: 0,
  annual_monthly_price_inr: null,
  period_days: 30,
  coins_included: 0,
  description: "",
  benefits: [],
};

export function PlanFormModal({
  plan,
  open,
  onClose,
}: {
  plan: PlanCatalogRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PlanInput>(EMPTY);
  const [benefitsText, setBenefitsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm({
        name: plan.name,
        price_inr: plan.price_inr,
        annual_monthly_price_inr: plan.annual_monthly_price_inr,
        period_days: plan.period_days,
        coins_included: plan.coins_included,
        description: plan.description ?? "",
        benefits: plan.benefits,
      });
      setBenefitsText(plan.benefits.join("\n"));
    } else {
      setForm(EMPTY);
      setBenefitsText("");
    }
    setError(null);
  }, [open, plan]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const input: PlanInput = {
      ...form,
      benefits: benefitsText.split("\n").map((b) => b.trim()).filter(Boolean),
    };
    const result = plan ? await updatePlanAction(plan.id, input) : await createPlanAction(input);
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
      title={plan ? `Edit ${plan.name}` : "Add plan"}
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
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Monthly price (₹)"
            type="number"
            value={form.price_inr}
            onChange={(e) => setForm({ ...form, price_inr: Number(e.target.value) })}
          />
          <TextField
            label="Monthly price when billed annually (₹, optional)"
            type="number"
            placeholder="Leave blank to disable annual billing"
            value={form.annual_monthly_price_inr ?? ""}
            onChange={(e) =>
              setForm({ ...form, annual_monthly_price_inr: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
        {form.annual_monthly_price_inr !== null && form.annual_monthly_price_inr > 0 && (
          <p className="-mt-2 text-xs text-muted">
            This is a <strong>per-month</strong> rate, not the year's total — a customer choosing annual billing is
            charged ₹{(form.annual_monthly_price_inr * 12).toLocaleString("en-IN")} once, up front, for 12 months.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Period (days)"
            type="number"
            value={form.period_days}
            onChange={(e) => setForm({ ...form, period_days: Number(e.target.value) })}
          />
          <TextField
            label="Credits included"
            type="number"
            value={form.coins_included}
            onChange={(e) => setForm({ ...form, coins_included: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            placeholder="What customers see"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Benefits (one per line)</label>
          <textarea
            value={benefitsText}
            onChange={(e) => setBenefitsText(e.target.value)}
            rows={4}
            placeholder={"e.g.\nUnlimited card scans\nPriority support\nExport to CSV"}
            className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
