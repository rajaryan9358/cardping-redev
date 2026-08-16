import { cn } from "@/lib/cn";

export function SuccessCheck({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-16 items-center justify-center rounded-full bg-success-bg animate-scale-in", className)}>
      <svg viewBox="0 0 24 24" fill="none" className="size-8 text-success-text">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          strokeDashoffset="24"
          className="animate-check-draw"
        />
      </svg>
    </span>
  );
}
