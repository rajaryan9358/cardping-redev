"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { ChannelLink } from "@/lib/types";

type Tab = "whatsapp" | "telegram";
type WhatsAppStep = "phone" | "otp";

const TELEGRAM_BOT_LINK = "https://t.me/cardping_bot";
const TELEGRAM_QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(TELEGRAM_BOT_LINK)}`;

export function LinkChannelClient({ existingLinks }: { existingLinks: ChannelLink[] }) {
  const [links, setLinks] = useState(existingLinks);
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [waStep, setWaStep] = useState<WhatsAppStep>("phone");
  const [collision, setCollision] = useState(false);
  const [disconnecting, setDisconnecting] = useState<ChannelLink | null>(null);

  const connected = links.find((l) => l.channel === tab);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Link a Channel</h1>
        <p className="text-sm text-muted">Connect your communication channels to manage leads directly from CardPing.</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        <div className="flex gap-1 border-b border-border p-2">
          {(["whatsapp", "telegram"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setCollision(false);
              }}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-active-bg hover:text-ink",
              )}
            >
              {t}
              {links.some((l) => l.channel === t) && <CheckCircle2 className="ml-1.5 inline size-3.5 text-success-text" strokeWidth={2} />}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 px-10 py-12 text-center">
          {connected ? (
            <>
              <Image src={`/icons/channel-${tab}.svg`} alt="" width={28} height={28} className="rounded-xl bg-active-bg p-4" />
              <div>
                <h2 className="text-xl font-semibold text-ink capitalize">{tab} connected</h2>
                <p className="text-sm text-muted">{connected.identifier}</p>
              </div>
              <Button variant="destructive" onClick={() => setDisconnecting(connected)}>
                Disconnect {tab}
              </Button>
            </>
          ) : tab === "whatsapp" ? (
            <>
              <Image src="/icons/channel-whatsapp.svg" alt="" width={28} height={28} className="rounded-xl bg-active-bg p-4" />
              <div>
                <h2 className="text-xl font-semibold text-ink">Connect WhatsApp</h2>
                <p className="text-sm text-muted">Enter your phone number to receive a verification code.</p>
              </div>

              {collision && (
                <Banner
                  className="w-full max-w-sm text-left"
                  message="This WhatsApp number is already connected to another CardPing account. Disconnect it there first, then try again."
                />
              )}

              <form
                className="flex w-full max-w-sm flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWaStep("otp");
                }}
              >
                <div className="flex flex-col items-start gap-1.5 text-left">
                  <label className="text-xs font-semibold tracking-wide text-muted-2">Phone Number</label>
                  <div className="flex w-full items-stretch rounded-lg border border-border bg-surface-warm">
                    <span className="flex items-center border-r border-border px-3 text-sm text-ink">+91</span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      required
                      className="w-full rounded-r-lg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full py-3">
                  Send Verification Code
                </Button>
              </form>

              {waStep === "otp" && (
                <div className="flex w-full max-w-sm flex-col items-center gap-3 border-t border-border pt-6">
                  <span className="text-sm font-medium text-ink">Enter 6-digit OTP</span>
                  <div className="flex gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={i}
                        maxLength={1}
                        inputMode="numeric"
                        className="size-11 rounded-lg border border-border text-center text-xl font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted">Resend Code in 0:45</span>
                  <button
                    type="button"
                    onClick={() =>
                      setLinks((prev) => [
                        ...prev,
                        { id: `cl_${Date.now()}`, channel: "whatsapp", identifier: "+91 98765 43210", connectedAt: new Date().toISOString() },
                      ])
                    }
                    className="text-xs font-semibold text-accent underline"
                  >
                    Simulate: verify &amp; connect
                  </button>
                  <button type="button" onClick={() => setCollision(true)} className="text-xs text-muted underline">
                    Simulate: number already linked
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-ink">Connect Telegram</h2>
                <p className="text-sm text-muted">
                  Scan the code below with your phone&apos;s camera, or click the link to start the CardPing bot in Telegram.
                </p>
              </div>

              <Image src={TELEGRAM_QR_SRC} alt="Telegram connect QR code" width={180} height={180} unoptimized className="rounded-xl border border-border" />

              <Link href={TELEGRAM_BOT_LINK} target="_blank" className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                t.me/cardping_bot <ExternalLink className="size-3.5" strokeWidth={2} />
              </Link>

              <div className="flex items-center gap-2 rounded-lg border border-border bg-active-bg px-4 py-2.5 text-sm text-muted">
                <span className="size-2 animate-pulse rounded-full bg-accent" />
                Waiting for you to tap Start in Telegram...
              </div>
              <button
                type="button"
                onClick={() =>
                  setLinks((prev) => [
                    ...prev,
                    { id: `cl_${Date.now()}`, channel: "telegram", identifier: "@janedoe", connectedAt: new Date().toISOString() },
                  ])
                }
                className="text-xs font-semibold text-accent underline"
              >
                Simulate: Start tapped &amp; connected
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!disconnecting}
        title={disconnecting ? `Disconnect ${disconnecting.channel}?` : ""}
        description="Scans from this channel will stop reaching your directory until you reconnect it."
        confirmLabel="Disconnect"
        onConfirm={() => {
          setLinks((prev) => prev.filter((l) => l.id !== disconnecting?.id));
          setDisconnecting(null);
        }}
        onCancel={() => setDisconnecting(null)}
      />
    </div>
  );
}
