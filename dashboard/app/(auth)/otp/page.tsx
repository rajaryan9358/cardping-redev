"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get("context") ?? "login";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(context === "channel-link" ? "/onboarding/link?connected=whatsapp" : "/home");
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
            <span className="font-semibold text-ink">+91 ••••• ••210</span>
          </p>
        </div>

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
          <Button type="submit" className="w-full py-3">
            Verify Code
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-border pt-6">
          {secondsLeft > 0 ? (
            <p className="text-sm text-muted">
              Resend code in <span className="font-semibold text-ink">{minutes}:{seconds}</span>
            </p>
          ) : (
            <button type="button" onClick={() => setSecondsLeft(RESEND_SECONDS)} className="text-sm font-semibold text-accent">
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
