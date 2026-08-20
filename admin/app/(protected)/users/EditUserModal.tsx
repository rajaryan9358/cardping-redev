"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField } from "../../../components/ui/TextField";
import { updateUserProfileAction, updateAccountProfileAction, ProfilePatch } from "./actions";

export interface EditUserTarget {
  id: string;
  kind: "account" | "unlinked_user";
  full_name: string | null;
  email: string | null;
}

export function EditUserModal({ target, onClose }: { target: EditUserTarget | null; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setFullName(target.full_name ?? "");
      setEmail(target.email ?? "");
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const patch: ProfilePatch = { full_name: fullName, email: email || null };
      const update = target!.kind === "account" ? updateAccountProfileAction : updateUserProfileAction;
      await update(target!.id, patch);
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
      title="Edit profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
        {error && <p className="text-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
  );
}
