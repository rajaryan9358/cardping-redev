"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar, ChevronDown, CreditCard, History, Home, KeyRound, LogOut, Plug, Settings, ShieldCheck, User, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { performLogout } from "@/lib/logout";
import { useMobileNav } from "./MobileNavContext";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/directory", label: "Directory", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
];

const PROFILE_ITEMS = [
  { href: "/profile/personal", label: "Personal Info", icon: User },
  { href: "/profile/channels", label: "Channels", icon: Plug },
  { href: "/profile/preferences", label: "Scan Preferences", icon: Settings },
  { href: "/profile/password", label: "Change Password", icon: KeyRound },
  { href: "/profile/sessions", label: "Sessions", icon: ShieldCheck },
  { href: "/profile/transactions", label: "Transaction History", icon: History },
];

/** The one sidebar every authenticated page renders. Not per-page — that
 * drift is exactly what this redesign (and the build before it) avoids.
 * Admin is a separate application per the product decision — no admin
 * nav item or pages live in this app. Profile is a dropdown group rather
 * than a single link since it now covers 5 distinct sub-pages, and starts
 * expanded by default since it's always reachable from every page. */
export function Sidebar({
  planLabel,
  planTone,
  hasPassword = true,
}: {
  planLabel?: string;
  planTone?: "active" | "trial" | "inactive";
  hasPassword?: boolean;
}) {
  const pathname = usePathname();
  const profileActive = pathname.startsWith("/profile");
  const [profileOpen, setProfileOpen] = useState(true);
  const profileItems = hasPassword ? PROFILE_ITEMS : PROFILE_ITEMS.filter((item) => item.href !== "/profile/password");
  const { open, close } = useMobileNav();

  return (
    <>
      {/* Backdrop — mobile only, tap to close. Sidebar itself stays
          permanently visible on desktop (md:translate-x-0), so this never
          renders there regardless of `open`. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={close}
        className={cn(
          "fixed inset-0 z-30 bg-ink/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-surface py-8 pl-4 pr-3 transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-3 pb-8">
          <div className="flex items-center">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
              <span className="text-base font-bold leading-6 text-white">C</span>
            </div>
            <div className="flex flex-col pl-3">
              <h1 className="text-xl font-semibold leading-6 tracking-tight text-ink">CardPing</h1>
              <p className="text-xs font-medium leading-4 text-muted">Lead Management</p>
            </div>
          </div>
          <button type="button" aria-label="Close menu" onClick={close} className="text-muted-2 md:hidden">
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const isSubscription = item.href === "/subscription";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent-text" : "text-muted-2 hover:bg-active-bg hover:text-ink",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {isSubscription && planTone && (
                <span
                  title={planLabel}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    planTone === "active" && "bg-success-bg text-success-text",
                    planTone === "trial" && "bg-warning-bg text-warning-text",
                    planTone === "inactive" && "bg-danger-bg text-danger-text",
                  )}
                >
                  {planTone === "active" ? "Active" : planTone === "trial" ? "Trial" : "Expired"}
                </span>
              )}
            </Link>
          );
        })}

        <div>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              profileActive ? "bg-accent-soft text-accent-text" : "text-muted-2 hover:bg-active-bg hover:text-ink",
            )}
          >
            <User className="size-[18px]" strokeWidth={2} />
            <span className="flex-1 text-left">Profile</span>
            <ChevronDown className={cn("size-3.5 transition-transform", profileOpen && "rotate-180")} strokeWidth={2} />
          </button>
          {profileOpen && (
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
              {profileItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      active ? "bg-accent-soft text-accent-text" : "text-muted-2 hover:bg-active-bg hover:text-ink",
                    )}
                  >
                    <item.icon className="size-3.5" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void performLogout()}
                className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-border px-2.5 pt-2.5 text-xs font-medium text-danger-text hover:bg-danger-bg"
              >
                <LogOut className="size-3.5" strokeWidth={2} />
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
      </aside>
    </>
  );
}
