import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

interface BannerProps {
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Banner({ message, action, className }: BannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-warning-border/40 bg-warning-bg px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 shrink-0 text-warning-text" strokeWidth={2} />
        <p className="text-sm font-medium text-warning-text">{message}</p>
      </div>
      {action}
    </div>
  );
}
