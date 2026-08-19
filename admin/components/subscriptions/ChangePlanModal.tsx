"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Plan } from "../../lib/repositories/adminSubscriptions.repo";
import { setUserPlanAction } from "../../app/(protected)/subscriptions/actions";

export function ChangePlanModal({
  userId,
  userName,
  plans,
  onClose,
  onConfirm,
}: {
  userId: string | null;
  userName: string;
  plans: Plan[];
  onClose: () => void;
  /** Defaults to the channel-identity action (setUserPlanAction) — pass
   * this to target an account directly instead (see
   * SubscribedUsersTable's "account" kind rows). */
  onConfirm?: (id: string, planId: string) => Promise<void>;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) return null;

  async function handleSave() {
    if (!selectedPlanId) return;
    setSaving(true);
    setError(null);
    try {
      await (onConfirm ?? setUserPlanAction)(userId!, selectedPlanId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={userId !== null}
      onClose={onClose}
      title={`Change plan — ${userName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Confirm & record payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Records the payment and starts or extends the plan.</p>
        {plans.map((plan) => (
          <label
            key={plan.id}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={selectedPlanId === plan.id}
                onChange={() => setSelectedPlanId(plan.id)}
              />
              <div>
                <p className="text-sm font-medium text-ink">{plan.name}</p>
                <p className="text-xs text-muted">
                  ₹{plan.price_inr} · {plan.period_days} days · {plan.coins_included} coins
                </p>
              </div>
            </div>
          </label>
        ))}
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
