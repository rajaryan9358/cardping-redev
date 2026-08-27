"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { ChannelLink } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";

type Tab = "whatsapp" | "telegram";
type WhatsAppStep = "phone" | "otp";

const OTP_LENGTH = 6;

const ERROR_MESSAGES: Record<string, string> = {
  already_linked_elsewhere: "This number is already connected to another CardPing account. Disconnect it there first, then try again.",
  invalid: "That code isn't right. Try again.",
  expired: "This code has expired — send a new one.",
  too_many_attempts: "Too many attempts — send a new code.",
  whatsapp_otp_not_configured: "WhatsApp linking isn't set up yet.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

export function LinkChannelClient({
  existingLinks,
  initialTab = "whatsapp",
}: {
  existingLinks: ChannelLink[];
  initialTab?: Tab;
}) {
  const [links, setLinks] = useState(existingLinks);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [disconnecting, setDisconnecting] = useState<ChannelLink | null>(null);
  const authConfig = useAuthConfig();

  const connected = links.find((l) => l.channel === tab);

  async function handleDisconnect() {
    if (!disconnecting) return;
    await clientFetch(`/api/channels/${disconnecting.id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== disconnecting.id));
    setDisconnecting(null);
  }

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
              onClick={() => setTab(t)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-active-bg hover:text-ink",
              )}
            >
              <Image src={`/icons/channel-${t}.svg`} alt="" width={16} height={16} />
              {t}
              {links.some((l) => l.channel === t) && <CheckCircle2 className="inline size-3.5 text-success-text" strokeWidth={2} />}
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
            <WhatsAppConnect
              enabled={authConfig.whatsappOtpEnabled}
              onLinked={(identifier) =>
                setLinks((prev) => [...prev, { id: `pending_${Date.now()}`, channel: "whatsapp", identifier, connectedAt: new Date().toISOString() }])
              }
            />
          ) : (
            <TelegramConnect onLinked={() => window.location.reload()} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!disconnecting}
        title={disconnecting ? `Disconnect ${disconnecting.channel}?` : ""}
        description="Scans from this channel will stop reaching your directory until you reconnect it."
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnecting(null)}
      />
    </div>
  );
}

function WhatsAppConnect({ enabled, onLinked }: { enabled: boolean; onLinked: (identifier: string) => void }) {
  const [step, setStep] = useState<WhatsAppStep>("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const mobile = `+91${phone.replace(/\D/g, "")}`;

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/channels/whatsapp/otp/request", {
        method: "POST",
        body: JSON.stringify({ mobile }),
      });
      await parseJsonOrThrow(res);
      setStep("otp");
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  async function handleVerify() {
    setError(null);
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await clientFetch("/api/channels/whatsapp/otp/verify", {
        method: "POST",
        body: JSON.stringify({ mobile, code }),
      });
      await parseJsonOrThrow(res);
      onLinked(mobile);
    } catch (err) {
      setError(errorMessage((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Image src="/icons/channel-whatsapp.svg" alt="" width={28} height={28} className="rounded-xl bg-active-bg p-4" />
      <div>
        <h2 className="text-xl font-semibold text-ink">Connect WhatsApp</h2>
        <p className="text-sm text-muted">Enter your phone number to receive a verification code.</p>
      </div>

      {!enabled && (
        <Banner className="w-full max-w-sm text-left" message="WhatsApp linking isn't set up yet — check back soon." />
      )}
      {error && <Banner className="w-full max-w-sm text-left" message={error} />}

      <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={handleSendCode}>
        <div className="flex flex-col items-start gap-1.5 text-left">
          <label className="text-xs font-semibold tracking-wide text-muted-2">Phone Number</label>
          <div className="flex w-full items-stretch rounded-lg border border-border bg-surface-warm">
            <span className="flex items-center border-r border-border px-3 text-sm text-ink">+91</span>
            <input
              type="tel"
              placeholder="98765 43210"
              required
              disabled={!enabled}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-r-lg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <Button type="submit" className="w-full py-3" disabled={!enabled} loading={submitting && step === "phone"}>
          Send Verification Code
        </Button>
      </form>

      {step === "otp" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 border-t border-border pt-6">
          <span className="text-sm font-medium text-ink">Enter 6-digit OTP</span>
          <div className="flex gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                maxLength={1}
                inputMode="numeric"
                className="size-11 rounded-lg border border-border text-center text-xl font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            ))}
          </div>
          <Button onClick={handleVerify} loading={submitting} className="mt-2">
            Verify &amp; connect
          </Button>
        </div>
      )}
    </>
  );
}

function TelegramConnect({ onLinked }: { onLinked: () => void }) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch("/api/channels/telegram/link-code", { method: "POST" })
      .then((res) => parseJsonOrThrow<{ deepLink: string }>(res))
      .then((data) => setDeepLink(data.deepLink))
      .catch((err) => setError(errorMessage((err as Error).message)));
  }, []);

  // Linking happens on Telegram's side (the bot confirms the /start
  // payload) — there's no direct callback to this tab, so poll for it.
  useEffect(() => {
    if (!deepLink) return;
    const interval = setInterval(async () => {
      const res = await clientFetch("/api/channels");
      const { channelLinks } = await parseJsonOrThrow<{ channelLinks: { channel: string }[] }>(res);
      if (channelLinks.some((l) => l.channel === "telegram")) {
        clearInterval(interval);
        onLinked();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [deepLink, onLinked]);

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold text-ink">Connect Telegram</h2>
        <p className="text-sm text-muted">
          Scan the code below with your phone&apos;s camera, or click the link to start the CardPing bot in Telegram.
        </p>
      </div>

      {error && <Banner className="w-full max-w-sm text-left" message={error} />}

      {deepLink && (
        <>
          <Image
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(deepLink)}`}
            alt="Telegram connect QR code"
            width={180}
            height={180}
            unoptimized
            className="rounded-xl border border-border"
          />
          <Link href={deepLink} target="_blank" className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            Open in Telegram <ExternalLink className="size-3.5" strokeWidth={2} />
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-active-bg px-4 py-2.5 text-sm text-muted">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            Waiting for you to tap Start in Telegram...
          </div>
        </>
      )}
    </>
  );
}
