import { LinkChannelClient } from "./LinkChannelClient";
import { getChannelLinks } from "@/lib/data/account";

export default async function LinkChannelPage() {
  const channelLinks = await getChannelLinks();
  return <LinkChannelClient existingLinks={channelLinks} />;
}
