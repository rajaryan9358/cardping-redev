"use client";

import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const ERROR_MESSAGES: Record<string, string> = {
  current_password_incorrect: "Current password is incorrect.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await clientFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await parseJsonOrThrow(res);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="flex items-center gap-2 pb-4 text-base font-semibold text-ink">
        <Shield className="size-4 text-accent" strokeWidth={2} /> Change Password
      </h2>
      {error && <p className="mb-4 max-w-sm rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <TextField
          label="Current Password"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          label="New Password"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <TextField
          label="Confirm New Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" className="self-start" loading={submitting}>Update Password</Button>
          {saved && <span className="text-xs font-medium text-success-text">Password updated.</span>}
        </div>
      </form>
    </div>
  );
}
