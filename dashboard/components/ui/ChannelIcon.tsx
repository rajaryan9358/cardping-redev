import Image from "next/image";
import { Channel } from "@/lib/types";

const CHANNEL_ICON: Record<Channel, string> = {
  whatsapp: "/icons/channel-whatsapp.svg",
  telegram: "/icons/channel-telegram.svg",
};

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

/** Renders the WhatsApp/Telegram brand icon for a card/session's channel,
 * falling back to a plain dash for null/unrecognized values instead of a
 * broken <img> — `uploaded_by` is a nullable DB column, so this case is
 * real, not hypothetical (older/manually-created rows). */
export function ChannelIcon({ channel, size = 26 }: { channel: Channel | null | undefined; size?: number }) {
  if (!channel || !(channel in CHANNEL_ICON)) {
    return <span className="text-muted">—</span>;
  }
  return <Image src={CHANNEL_ICON[channel]} alt={CHANNEL_LABEL[channel]} width={size} height={size} />;
}

export function channelLabel(channel: Channel | null | undefined): string {
  if (!channel || !(channel in CHANNEL_LABEL)) return "Unknown";
  return CHANNEL_LABEL[channel];
}
