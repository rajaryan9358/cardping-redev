"use client";

import { Coins, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AvatarMenu } from "./AvatarMenu";
import { GlobalSearch } from "./GlobalSearch";
import { useMobileNav } from "./MobileNavContext";
import { Notification, NotificationsMenu } from "./NotificationsMenu";
import { pageTitle } from "@/lib/pageTitle";

interface TopBarProps {
  coinBalance: number;
  avatarUrl: string | null;
  accountName: string;
  accountEmail: string | null;
  notifications: Notification[];
}

export function TopBar({ coinBalance, avatarUrl, accountName, accountEmail, notifications }: TopBarProps) {
  const { toggle } = useMobileNav();
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 md:left-64 md:px-8">
      <button type="button" aria-label="Open menu" onClick={toggle} className="text-muted-2 md:hidden">
        <Menu className="size-6" strokeWidth={2} />
      </button>
      <h1 className="hidden truncate text-base font-semibold text-ink md:block">{pageTitle(pathname)}</h1>
      <GlobalSearch />
      <div className="flex items-center gap-2">
        <Link
          href="/subscription"
          className="mr-2 flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 transition-colors hover:bg-accent-soft/70"
        >
          <Coins className="size-4 text-accent" strokeWidth={2} />
          <span className="text-xs font-semibold tabular-nums text-accent-text">{coinBalance.toLocaleString()}</span>
        </Link>
        <NotificationsMenu notifications={notifications} />
        <AvatarMenu name={accountName} email={accountEmail} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
