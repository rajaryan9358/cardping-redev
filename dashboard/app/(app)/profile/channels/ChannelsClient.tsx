"use client";

import { Plug } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChannelLink } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";

export function ChannelsClient({ channelLinks: initialLinks }: { channelLinks: ChannelLink[] }) {
  const [channelLinks, setChannelLinks] = useState(initialLinks);
  const [disconnecting, setDisconnecting] = useState<ChannelLink | null>(null);

  const hasWhatsapp = channelLinks.some((l) => l.channel === "whatsapp");
  const hasTelegram = channelLinks.some((l) => l.channel === "telegram");

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between pb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Plug className="size-4 text-accent" strokeWidth={2} /> Linked Channels
        </h2>
        {(!hasWhatsapp || !hasTelegram) && (
          <Link href="/channels/link" className="text-xs font-semibold text-accent">
            + Link {hasWhatsapp ? "Telegram" : hasTelegram ? "WhatsApp" : "a channel"}
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {channelLinks.map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <Image
                src={link.channel === "whatsapp" ? "/icons/channel-whatsapp.svg" : "/icons/channel-telegram.svg"}
                alt=""
                width={22}
                height={22}
              />
              <div>
                <div className="text-sm font-medium capitalize text-ink">{link.channel}</div>
                <div className="text-xs text-muted">{link.identifier}</div>
              </div>
            </div>
            <button type="button" onClick={() => setDisconnecting(link)} className="text-xs font-semibold text-danger-text">
              Disconnect
            </button>
          </div>
        ))}
        {channelLinks.length === 0 && <p className="text-sm text-muted">No channels connected yet.</p>}
      </div>

      <ConfirmDialog
        open={!!disconnecting}
        title={disconnecting ? `Disconnect ${disconnecting.channel}?` : ""}
        description="Scans from this channel will stop reaching your directory until you reconnect it."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          if (!disconnecting) return;
          await clientFetch(`/api/channels/${disconnecting.id}`, { method: "DELETE" });
          setChannelLinks((prev) => prev.filter((l) => l.id !== disconnecting.id));
          setDisconnecting(null);
        }}
        onCancel={() => setDisconnecting(null)}
      />
    </div>
  );
}
