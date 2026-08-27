"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<((message: string) => void) | null>(null);

/** Minimal app-wide toast stack — no toast system existed anywhere in the
 * app before this; kept intentionally small (one variant, auto-dismiss)
 * rather than building out a full notification system nothing else needs
 * yet. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-soft"
          >
            <CheckCircle2 className="size-4 text-success-text" strokeWidth={2} />
            {t.message}
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 text-muted hover:text-ink"
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
