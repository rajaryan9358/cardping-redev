"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const AUTO_RETURN_SECONDS = 3;

/** Shared by /topup/status and /subscribe/status — both are Cashfree
 * return_url targets for a checkout that started from a bot-issued
 * magic-login link (see server/src/services/magicLoginService.ts), so both
 * need the same "confirmed, returning to your chat in Ns" behavior. */
export function StatusClient({ title, description }: { title: string; description: string }) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS);

  useEffect(() => {
    clientFetch(`/api/channels/return-url${returnTo ? `?channel=${returnTo}` : ""}`)
      .then((res) => parseJsonOrThrow<{ returnUrl: string | null }>(res))
      .then((data) => setReturnUrl(data.returnUrl))
      .catch(() => {
        /* no linked channel to return to — just show the confirmation */
      });
  }, [returnTo]);

  useEffect(() => {
    if (!returnUrl) return;
    if (secondsLeft <= 0) {
      window.location.href = returnUrl;
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [returnUrl, secondsLeft]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-success-bg">
        <CheckCircle2 className="size-7 text-success-text" strokeWidth={2} />
      </span>
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {returnUrl && (
        <>
          <p className="text-xs text-muted">Returning to your chat in {secondsLeft}s…</p>
          <button
            type="button"
            onClick={() => (window.location.href = returnUrl)}
            className="text-sm font-semibold text-accent"
          >
            Return now
          </button>
        </>
      )}
    </div>
  );
}
