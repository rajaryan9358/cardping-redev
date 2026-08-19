"use client";

import { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { AdminUserRow } from "../../../lib/repositories/adminUsers.repo";
import { adjustUserCoinsAction } from "./actions";

export function AdjustCoinsModal({
  user,
  onClose,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function handleSave() {
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a non-zero number — positive to add coins, negative to deduct.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adjustUserCoinsAction(user!.user_id, delta, reason);
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
      open={user !== null}
      onClose={onClose}
      title={`Adjust coins — ${user.full_name || "Unnamed user"}`}
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
          Current balance: <span className="font-medium text-ink">{user.effective_coin_balance}</span> coins
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
