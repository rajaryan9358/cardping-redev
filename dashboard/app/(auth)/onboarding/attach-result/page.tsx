"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { clientFetch } from "@/lib/clientFetch";

const CHANNEL_LABEL: Record<"whatsapp" | "telegram", string> = { whatsapp: "WhatsApp", telegram: "Telegram" };

/** Landed on when a bot's ?onboard= link resolves to an account that
 * already has a channel of that type linked — see
 * channelOnboardingService.attachChannelToAccount's "already_linked_elsewhere"
 * status, surfaced from both /auth/login and /onboarding/attach. Nothing
 * was attached; the account they're logged into is unchanged. */
function AttachResultContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") === "telegram" ? "telegram" : "whatsapp";
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await clientFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-warning-bg">
          <AlertTriangle className="size-7 text-warning-text" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">This account already has a {CHANNEL_LABEL[channel]} connected</h1>
          <p className="mt-2 text-sm text-muted">
            To connect this {CHANNEL_LABEL[channel]} number instead, disconnect the existing one first from Settings →
            Channels.
          </p>
        </div>
      </div>

      <Link href="/profile/channels">
        <Button className="w-full py-3.5 text-base">Go to Channel Settings</Button>
      </Link>

      <Button variant="secondary" className="w-full py-3.5 text-base" loading={loggingOut} onClick={handleLogout}>
        Log out and use a different account
      </Button>

      <Link href="/home" className="pb-4 text-center text-sm font-medium text-muted hover:text-ink">
        Skip to dashboard
      </Link>
    </div>
  );
}

export default function AttachResultPage() {
  return (
    <Suspense>
      <AttachResultContent />
    </Suspense>
  );
}
