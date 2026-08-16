"use client";

import { Shield } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export function PasswordForm() {
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="flex items-center gap-2 pb-4 text-base font-semibold text-ink">
        <Shield className="size-4 text-accent" strokeWidth={2} /> Change Password
      </h2>
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <TextField label="Current Password" type="password" required />
        <TextField label="New Password" type="password" required />
        <TextField label="Confirm New Password" type="password" required />
        <div className="flex items-center gap-3">
          <Button type="submit" className="self-start">Update Password</Button>
          {saved && <span className="text-xs font-medium text-success-text">Password updated.</span>}
        </div>
      </form>
    </div>
  );
}
