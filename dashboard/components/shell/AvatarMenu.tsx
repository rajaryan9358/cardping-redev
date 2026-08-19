"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { performLogout } from "@/lib/logout";

export function AvatarMenu({ name, email, avatarUrl }: { name: string; email: string | null; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Account menu" className="block size-9 overflow-hidden rounded-full border border-border bg-active-bg">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={36} height={36} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-xs font-semibold text-muted-2">
            {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-ink">{name}</p>
              {email && <p className="text-xs text-muted">{email}</p>}
            </div>
            <div className="p-1.5">
              <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-2 hover:bg-active-bg hover:text-ink">
                <User className="size-4" /> Profile
              </Link>
              <Link href="/subscription" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-2 hover:bg-active-bg hover:text-ink">
                <Settings className="size-4" /> Billing &amp; Plan
              </Link>
              <button
                type="button"
                onClick={() => void performLogout()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger-text hover:bg-danger-bg"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
