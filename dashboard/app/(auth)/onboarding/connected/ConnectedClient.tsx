"use client";

import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChannelLink } from "@/lib/types";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";
import { LinkChannelClient } from "@/app/(app)/channels/link/LinkChannelClient";

const CHANNEL_LABEL: Record<"whatsapp" | "telegram", string> = { whatsapp: "WhatsApp", telegram: "Telegram" };

export function ConnectedClient({ existingLinks }: { existingLinks: ChannelLink[] }) {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") === "telegram" ? "telegram" : "whatsapp";
  const returnUrl = searchParams.get("returnUrl") || "";
  const otherChannel = channel === "whatsapp" ? "telegram" : "whatsapp";
  const { startingCoins } = useAuthConfig();

  function handleStartScanning() {
    if (returnUrl) window.location.href = returnUrl;
    // Best-effort — no-ops silently unless this tab was opened via
    // window.open(); the redirect above is what actually gets the user
    // back into WhatsApp/Telegram on mobile.
    window.close();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 className="size-7 text-success-text" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">You&apos;re connected!</h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
            <Image src={`/icons/channel-${channel}.svg`} alt="" width={16} height={16} />
            {CHANNEL_LABEL[channel]} is now linked to your CardPing account
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center rounded-full bg-accent-soft px-4 py-2.5 text-center">
        <span className="text-xs font-semibold tracking-wide text-accent-text">
          🎉 You&apos;ve got {startingCoins} free credits to try CardPing
        </span>
      </div>

      <Button className="w-full py-3.5 text-base" onClick={handleStartScanning}>
        Start scanning
      </Button>

      <LinkChannelClient existingLinks={existingLinks} initialTab={otherChannel} />

      <Link href="/home" className="pb-4 text-center text-sm font-medium text-muted hover:text-ink">
        Skip to dashboard
      </Link>
    </div>
  );
}
