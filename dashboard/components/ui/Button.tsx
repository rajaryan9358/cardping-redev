import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "destructive" | "dangerSolid";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

// Each variant is a self-contained class string so overriding one color
// via `className` can't collide with a variant's own color utility of the
// same CSS property (Tailwind's generated order — not JSX class order —
// decides which wins, so partial overrides are unreliable). Need a solid
// red button on a dark background (e.g. the bulk-action bar)? Use
// `dangerSolid`, don't try to reskin `primary`.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-soft hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-border hover:bg-active-bg",
  destructive: "bg-white text-danger-text border border-border hover:bg-danger-bg",
  dangerSolid: "bg-red-500 text-white shadow-soft hover:bg-red-600",
};

export function Button({ variant = "primary", className, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
