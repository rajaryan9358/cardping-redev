import { cn } from "@/lib/cn";

export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-border bg-surface shadow-soft", className)}>
      {/* Rows use flex-1 columns, which squish to fit rather than overflow
          on their own — the min-width forces genuine horizontal scrolling
          on narrow screens instead of illegible, cramped columns. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">{children}</div>
      </div>
    </div>
  );
}

export function TableHeaderRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center border-b border-border bg-surface-warm">{children}</div>;
}

export function Th({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <div
      className={cn(
        "flex-1 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center border-b border-border last:border-b-0 hover:bg-surface-warm/60", className)}>{children}</div>;
}

export function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <div
      className={cn(
        "flex-1 px-6 py-3.5 text-sm text-muted-2",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
