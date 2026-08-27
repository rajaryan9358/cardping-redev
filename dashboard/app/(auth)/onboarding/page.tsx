"use client";

import { ArrowRight, Coins, Gift, IdCard, QrCode, Smartphone, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { clientFetch } from "@/lib/clientFetch";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";

const STEPS = ["welcome", "coins", "connect"] as const;
type Step = (typeof STEPS)[number];

function ProgressDots({ step }: { step: Step }) {
  const index = STEPS.indexOf(step);
  return (
    <div className="flex justify-center gap-1.5 pb-8">
      {STEPS.map((s, i) => (
        <span key={s} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-accent" : "w-1.5 bg-border")} />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const { startingCoins } = useAuthConfig();

  return (
    <div className="w-full max-w-[510px] rounded-2xl border border-border bg-white p-10 shadow-soft">
      <ProgressDots step={step} />

      {step === "welcome" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-56 w-full items-center justify-center gap-4 rounded-xl bg-accent-soft">
            <Smartphone className="size-9 text-accent" strokeWidth={1.5} />
            <IdCard className="size-11 text-accent" strokeWidth={1.5} />
            <Zap className="size-9 text-accent" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">Welcome to CardPing</h1>
            <p className="text-sm text-muted">
              Digitize your network instantly. Simply snap a photo of any business card and send it via WhatsApp or
              Telegram to automatically extract and save contact details.
            </p>
          </div>
          <Button className="gap-2 px-8 py-3" onClick={() => setStep("coins")}>
            Next <ArrowRight className="size-4" strokeWidth={2} />
          </Button>
        </div>
      )}

      {step === "coins" && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Your Scanning Power</h1>
            <p className="text-sm text-muted">CardPing uses a simple credit system to meter your card scans. Let&apos;s get you started.</p>
          </div>

          <div className="flex flex-col items-center gap-1 rounded-xl bg-accent-soft px-16 py-8">
            <Coins className="size-7 text-accent" strokeWidth={1.75} />
            <span className="text-4xl font-semibold text-ink">{startingCoins}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-text">Free Credits</span>
          </div>

          <div className="flex w-full flex-col gap-5 rounded-xl border border-border p-5">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Zap className="size-4" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">1 Scan = 1 Credit</h3>
                <p className="text-xs text-muted">Every time you scan a new business card and add it to your directory, it uses one credit.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Gift className="size-4" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">Your Free Trial</h3>
                <p className="text-xs text-muted">We&apos;ve loaded your account with {startingCoins} free credits to help you experience the full power of CardPing.</p>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center justify-between border-t border-border pt-6">
            <button type="button" onClick={() => setStep("welcome")} className="text-sm text-muted hover:text-ink">
              Back
            </button>
            <Button
              onClick={() => {
                setStep("connect");
                // Idempotent server-side — safe if the user backs up and
                // forward again through the steps.
                void clientFetch("/api/onboarding/complete", { method: "POST" });
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === "connect" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex size-24 items-center justify-center rounded-xl bg-accent-soft">
            <QrCode className="size-10 text-accent" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Ready to start scanning?</h1>
            <p className="text-sm text-muted">
              Your {startingCoins} free credits are waiting — connect WhatsApp or Telegram now to start scanning cards
              with them.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <Link href="/channels/link">
              <Button className="w-full gap-2 py-3">Connect WhatsApp or Telegram</Button>
            </Link>
            <Link href="/home">
              <Button variant="secondary" className="w-full py-3">
                I&apos;ll do this later
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
