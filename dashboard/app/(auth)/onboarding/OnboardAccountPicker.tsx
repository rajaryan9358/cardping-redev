"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

interface AttachResponse {
  status: "linked" | "already_linked_elsewhere" | "invalid_token";
  linkedChannel?: "whatsapp" | "telegram";
  returnUrl?: string;
}

const CHANNEL_LABEL: Record<"whatsapp" | "telegram", string> = { whatsapp: "WhatsApp", telegram: "Telegram" };

/** Shown on the signup/login pages when a bot's ?onboard= link is opened in
 * a browser that already has a session — the "account picker" case: attach
 * this channel to the account already signed in, or log out first to use a
 * different one. See server's POST /onboarding/attach. */
export function OnboardAccountPicker({
  accountEmail,
  onboardToken,
  channel,
}: {
  accountEmail: string | null;
  onboardToken: string;
  channel: "whatsapp" | "telegram";
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/onboarding/attach", {
        method: "POST",
        body: JSON.stringify({ onboardToken }),
      });
      const attach = await parseJsonOrThrow<AttachResponse>(res);
      if (attach.status === "linked") {
        router.push(
          `/onboarding/connected?channel=${attach.linkedChannel}&returnUrl=${encodeURIComponent(attach.returnUrl ?? "")}`,
        );
        return;
      }
      if (attach.status === "already_linked_elsewhere") {
        router.push(`/onboarding/attach-result?channel=${channel}`);
        return;
      }
      setError("That link has expired — send another message on WhatsApp or Telegram to get a fresh one.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await clientFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/signup?onboard=${encodeURIComponent(onboardToken)}`;
  }

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-6 rounded-2xl border border-border bg-white p-8 text-center shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">You&apos;re already signed in</h2>
        <p className="mt-1 text-sm text-muted">
          {accountEmail ? `As ${accountEmail}` : "With an existing session"} — connect this {CHANNEL_LABEL[channel]} to
          this account, or log out to sign into a different one.
        </p>
      </div>

      {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-left text-sm text-danger-text">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button className="w-full py-3" loading={submitting} onClick={handleContinue}>
          Connect to this account
        </Button>
        <Button variant="secondary" className="w-full py-3" loading={loggingOut} onClick={handleLogout}>
          Log out and use a different account
        </Button>
      </div>
    </div>
  );
}
