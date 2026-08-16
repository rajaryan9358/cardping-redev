import { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelAction?: React.ReactNode;
}

export function TextField({ label, labelAction, id, ...props }: TextFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-xs font-semibold tracking-wide text-muted-2">
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={inputId}
        className="w-full rounded-lg border border-border bg-surface-warm px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        {...props}
      />
    </div>
  );
}
