"use client";

import { usePathname } from "next/navigation";
import { Activity, Bell, CreditCard, IdCard, Calendar, LogOut, Megaphone, ScrollText, SlidersHorizontal, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "../../app/(protected)/actions";

const NAV_ITEMS = [
  { href: "/users", label: "Users", icon: Users },
  { href: "/cards", label: "Cards", icon: IdCard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/health", label: "Bot / Scan Health", icon: Activity },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/env", label: "Env Variables", icon: SlidersHorizontal },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
];

export function Sidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-border bg-surface py-5 pl-4 pr-3">
      <div className="flex items-center px-3 pb-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <span className="text-base font-bold leading-6 text-white">C</span>
        </div>
        <div className="flex flex-col pl-3">
          <h1 className="text-xl font-semibold leading-6 tracking-tight text-ink">CardPing</h1>
          <p className="text-xs font-medium leading-4 text-muted">Admin</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            // Plain <a>, not next/link: a soft navigation here would revive
            // whatever Next's client Router Cache last painted for this exact
            // URL, however stale — a hard navigation always requests fresh
            // HTML, so there is no cache layer left to serve something wrong.
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent-text" : "text-muted-2 hover:bg-active-bg hover:text-ink",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={2} />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border px-3 pt-3">
        <p className="truncate text-xs text-muted" title={adminEmail}>
          {adminEmail}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-danger-text hover:bg-danger-bg"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
