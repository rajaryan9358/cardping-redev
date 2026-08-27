"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { Account } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

export function PersonalInfoForm({ account }: { account: Account }) {
  const [firstName, setFirstName] = useState(account.fullName.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(account.fullName.split(" ").slice(1).join(" "));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      });
      await parseJsonOrThrow(res);
      showToast("Profile saved successfully");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="relative size-20 overflow-hidden rounded-full bg-accent-soft">
            {account.avatarUrl ? (
              <Image src={account.avatarUrl} alt="" width={80} height={80} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-lg font-semibold text-accent-text">
                {account.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
            )}
          </div>
          <Button variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs">
            <Camera className="size-3.5" strokeWidth={2} /> Change Avatar
          </Button>
          <button type="button" className="text-xs text-muted hover:text-ink">Remove</button>
        </div>
        <form onSubmit={handleSubmit} className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text sm:col-span-2">{error}</p>
          )}
          <TextField label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label="Last Name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <div className="sm:col-span-2">
            <TextField
              label="Email Address"
              type="email"
              defaultValue={account.email ?? ""}
              disabled
              title="Contact support to change your email"
            />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Job Title" placeholder="Senior Lead Strategist" />
          </div>
          <div className="flex justify-end pt-2 sm:col-span-2">
            <Button type="submit" loading={submitting}>Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
