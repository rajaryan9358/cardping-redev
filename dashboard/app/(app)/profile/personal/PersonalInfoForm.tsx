"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Account } from "@/lib/types";

export function PersonalInfoForm({ account }: { account: Account }) {
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
        <form className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="First Name" defaultValue={account.fullName.split(" ")[0]} />
          <TextField label="Last Name" defaultValue={account.fullName.split(" ").slice(1).join(" ")} />
          <div className="sm:col-span-2">
            <TextField label="Email Address" type="email" defaultValue={account.email ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Job Title" placeholder="Senior Lead Strategist" />
          </div>
          <div className="flex justify-end pt-2 sm:col-span-2">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
