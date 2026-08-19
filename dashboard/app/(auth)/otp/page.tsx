"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That code isn't right. Try again.",
  expired: "This code has expired — send a new one.",
  too_many_attempts: "Too many attempts — send a new code.",
  already_linked_elsewhere: "This WhatsApp number is already connected to another CardPing account — disconnect it there first.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

interface VerifyAccount {
  onboarded_at: string | null;
}

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get("context") ?? "login";
  const mobile = searchParams.get("mobile") ?? "";

  const requestPath = context === "channel-link" ? "/api/channels/whatsapp/otp/request" : "/api/auth/otp/request";
  const verifyPath = context === "channel-link" ? "/api/channels/whatsapp/otp/verify" : "/api/auth/otp/verify";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await clientFetch(verifyPath, { method: "POST", body: JSON.stringify({ mobile, code }) });
      if (context === "channel-link") {
        await parseJsonOrThrow(res);
        router.push("/profile/channels?connected=whatsapp");
        return;
      }
      const { account } = await parseJsonOrThrow<{ account: VerifyAccount }>(res);
      router.push(account.onboarded_at ? "/home" : "/onboarding");
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const res = await clientFetch(requestPath, { method: "POST", body: JSON.stringify({ mobile }) });
      await parseJsonOrThrow(res);
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage((err as Error).message));
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6 rounded-2xl border border-border bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold text-ink">Verify your identity</h2>
          <p className="text-sm text-muted">
            We sent a 6-digit code to
            <br />
            <span className="font-semibold text-ink">{mobile || "your phone"}</span>
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-center text-sm text-danger-text">{error}</p>
        )}

        <div className="flex flex-col gap-6 pt-2">
          <div className="flex items-stretch justify-between gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                inputMode="numeric"
                maxLength={1}
                className={cn(
                  "w-full flex-1 rounded-lg border py-2.5 text-center text-2xl font-semibold focus:outline-none",
                  digit ? "border-accent text-ink ring-2 ring-accent/20" : "border-border text-muted-2",
                )}
              />
            ))}
          </div>
          <Button type="submit" className="w-full py-3" loading={submitting}>
            Verify Code
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-border pt-6">
          {secondsLeft > 0 ? (
            <p className="text-sm text-muted">
              Resend code in <span className="font-semibold text-ink">{minutes}:{seconds}</span>
            </p>
          ) : (
            <button type="button" onClick={handleResend} className="text-sm font-semibold text-accent">
              Resend code
            </button>
          )}
          <Link href="/login?mode=otp" className="text-xs font-semibold tracking-wide text-muted hover:text-ink">
            Change number
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function OtpPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}
