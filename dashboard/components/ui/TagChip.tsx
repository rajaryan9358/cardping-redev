import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function TagChip({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-active-bg px-2.5 py-1 text-xs text-muted-2",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove tag ${children}`} className="text-muted hover:text-ink">
          <X className="size-3" strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
