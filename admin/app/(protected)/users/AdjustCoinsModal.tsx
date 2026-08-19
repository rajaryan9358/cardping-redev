"use client";

import { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { adjustUserCoinsAction } from "./actions";

export interface AdjustCoinsTarget {
  id: string;
  full_name: string | null;
  effective_coin_balance: number;
}

export function AdjustCoinsModal({
  target,
  onConfirm = adjustUserCoinsAction,
  onClose,
}: {
  target: AdjustCoinsTarget | null;
  /** Defaults to the channel-identity action (adjustUserCoinsAction) —
   * pass this to target an account directly instead (see UsersTable's
   * "account" kind rows). */
  onConfirm?: (id: string, delta: number, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!target) return null;

  async function handleSave() {
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a non-zero number — positive to add coins, negative to deduct.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(target!.id, delta, reason);
      setAmount("");
      setReason("");
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
      title={`Adjust coins — ${target.full_name || "Unnamed user"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Current balance: <span className="font-medium text-ink">{target.effective_coin_balance}</span> coins
        </p>
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 10 or -5"
        />
        <TextField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this adjustment being made?"
        />
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
