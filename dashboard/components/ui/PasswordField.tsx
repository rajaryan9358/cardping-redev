"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useState } from "react";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  labelAction?: React.ReactNode;
}

/** Same visual language as TextField, plus a show/hide toggle. Defaults
 * every password input's placeholder to a real hint instead of a literal
 * dot/star string, which used to render indistinguishably from a masked
 * value and made empty fields look pre-filled. */
export function PasswordField({ label, labelAction, id, placeholder, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-xs font-semibold tracking-wide text-muted-2">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative w-full">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          placeholder={placeholder ?? "At least 8 characters"}
          className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
