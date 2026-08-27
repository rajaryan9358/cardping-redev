import Image from "next/image";

type Channel = "whatsapp" | "telegram";

const CHANNEL_ICON: Record<Channel, string> = {
  whatsapp: "/icons/channel-whatsapp.svg",
  telegram: "/icons/channel-telegram.svg",
};
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", telegram: "Telegram" };

export function ChannelIcon({ channel, size = 20 }: { channel: string | null | undefined; size?: number }) {
  if (!channel || !(channel in CHANNEL_ICON)) {
    return <span className="text-muted">—</span>;
  }
  return <Image src={CHANNEL_ICON[channel as Channel]} alt={CHANNEL_LABEL[channel as Channel]} width={size} height={size} />;
}
