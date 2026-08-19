"use client";

import { BadgeCheck, Building2, Lock, LucideIcon, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";
import { useExistingSession } from "@/lib/hooks/useExistingSession";
import { OnboardAccountPicker } from "../onboarding/OnboardAccountPicker";

function IconField({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} />
      <input
        className="w-full rounded-lg border border-border bg-surface-warm py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        {...props}
      />
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  email_already_registered: "An account with this email already exists.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

function maskIdentifier(identifier: string): string {
  const kept = identifier.slice(-4);
  return `${identifier.slice(0, -4).replace(/\d/g, "•")}${kept}`;
}

interface ChannelContext {
  channel: "whatsapp" | "telegram";
  channelIdentifier: string;
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardToken = searchParams.get("onboard");
  const { startingCoins } = useAuthConfig();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [channelContext, setChannelContext] = useState<ChannelContext | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const { loading: sessionLoading, account: existingAccount } = useExistingSession(Boolean(onboardToken));

  useEffect(() => {
    if (!onboardToken) return;
    clientFetch(`/api/onboarding/channel-token?token=${encodeURIComponent(onboardToken)}`)
      .then((res) => parseJsonOrThrow<ChannelContext>(res))
      .then(setChannelContext)
      .catch(() => setTokenExpired(true));
  }, [onboardToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await clientFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || undefined,
          onboardToken: channelContext ? onboardToken : undefined,
          marketingOptIn,
        }),
      });
      const { linkedChannel, returnUrl } = await parseJsonOrThrow<{ linkedChannel?: string; returnUrl?: string }>(res);
      router.push(
        linkedChannel
          ? `/onboarding/connected?channel=${linkedChannel}&returnUrl=${encodeURIComponent(returnUrl ?? "")}`
          : "/onboarding",
      );
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  // Opened while a dashboard session is already active (the account-picker
  // case) — skip the create-account form entirely and let the visitor
  // attach this channel to the signed-in account, or log out first.
  if (onboardToken && channelContext && existingAccount) {
    return (
      <div className="flex w-full max-w-[480px] flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">CardPing</h1>
        </div>
        <OnboardAccountPicker
          accountEmail={existingAccount.email}
          onboardToken={onboardToken}
          channel={channelContext.channel}
        />
      </div>
    );
  }

  if (onboardToken && sessionLoading) {
    return <div className="size-11 animate-pulse rounded-xl bg-accent-soft" aria-hidden />;
  }

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">C</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">CardPing</h1>
        <p className="text-sm text-muted">Create your account to start managing leads</p>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-white p-8 shadow-soft">
        {channelContext && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-success-bg px-4 py-3">
            <MessageCircle className="size-4 shrink-0 text-success-text" strokeWidth={2} />
            <p className="text-sm font-medium text-success-text">
              Connecting your {channelContext.channel === "whatsapp" ? "WhatsApp" : "Telegram"}
              {channelContext.channel === "whatsapp" ? ` number ending ${maskIdentifier(channelContext.channelIdentifier)}` : " account"}
            </p>
          </div>
        )}
        {tokenExpired && (
          <Banner message="That link has expired — send another message on WhatsApp or Telegram to get a fresh one. You can still sign up below." />
        )}

        {error && (
          <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Full name</label>
            <IconField
              icon={Building2}
              type="text"
              placeholder="Jane Doe"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Email address</label>
            <IconField
              icon={Mail}
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Password</label>
            <IconField
              icon={Lock}
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-2">Confirm password</label>
            <IconField
              icon={Lock}
              type="password"
              placeholder="••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" required className="mt-0.5 size-4 rounded border-border text-accent" />
            <span>
              I agree to the <span className="text-ink">Terms of Service</span> and <span className="text-ink">Privacy Policy</span>.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent"
            />
            <span>Send me occasional offers and news about CardPing.</span>
          </label>

          <Button type="submit" className="w-full py-3" loading={submitting}>
            Create account
          </Button>
        </form>

        <div className="flex justify-center border-t border-border pt-6">
          <div className="flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2">
            <BadgeCheck className="size-4 text-accent" strokeWidth={2} />
            <span className="text-xs font-semibold tracking-wide text-accent-text">{startingCoins} free scans to start, no card required</span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={onboardToken ? `/login?onboard=${encodeURIComponent(onboardToken)}` : "/login"}
          className="text-sm font-semibold text-accent"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
