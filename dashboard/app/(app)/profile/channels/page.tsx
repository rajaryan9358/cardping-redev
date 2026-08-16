import { ProfileHeader } from "../ProfileHeader";
import { ChannelsClient } from "./ChannelsClient";
import { getChannelLinks } from "@/lib/data/account";

export default async function ChannelsPage() {
  const channelLinks = await getChannelLinks();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader title="Channels" description="Manage the WhatsApp and Telegram channels connected to your account." />
      <ChannelsClient channelLinks={channelLinks} />
    </div>
  );
}
