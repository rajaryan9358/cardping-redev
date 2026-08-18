"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface TabDef {
  id: string;
  label: string;
  // A rendered icon element, not a component reference — component
  // references (functions) can't cross the server→client prop boundary,
  // only already-rendered ReactNode can (see docs/DASHBOARD_PLAN.md note
  // near the Profile page for where this bit).
  icon?: React.ReactNode;
  content: React.ReactNode;
}

export function Tabs({ tabs, defaultTabId }: { tabs: TabDef[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-border bg-surface-warm p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab.id === active?.id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">{active?.content}</div>
    </div>
  );
}
