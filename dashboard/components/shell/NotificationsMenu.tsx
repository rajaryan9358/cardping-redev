"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface Notification {
  id: string;
  message: string;
  timeAgo: string;
  unread: boolean;
}

export function NotificationsMenu({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-2 hover:bg-active-bg hover:text-ink"
      >
        <Bell className="size-[18px]" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className={cn("flex items-start gap-2 border-b border-border px-4 py-3 last:border-b-0", n.unread && "bg-accent-soft/30")}>
                  {n.unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />}
                  <div className={cn(!n.unread && "pl-3.5")}>
                    <p className="text-sm text-ink">{n.message}</p>
                    <p className="pt-0.5 text-xs text-muted">{n.timeAgo}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
