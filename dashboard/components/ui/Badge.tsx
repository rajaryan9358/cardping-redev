import { cn } from "@/lib/cn";

type BadgeTone = "success" | "danger" | "pending" | "accent";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success-text",
  danger: "bg-danger-bg text-danger-text",
  pending: "bg-pending-bg text-pending-text",
  accent: "bg-accent-soft text-accent-text",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", toneClasses[tone])}>
      {children}
    </span>
  );
}
