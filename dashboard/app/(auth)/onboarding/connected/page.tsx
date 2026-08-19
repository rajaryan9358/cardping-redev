import { Suspense } from "react";
import { getChannelLinks } from "@/lib/data/account";
import { ConnectedClient } from "./ConnectedClient";

export default async function ConnectedPage() {
  const channelLinks = await getChannelLinks();
  return (
    <Suspense>
      <ConnectedClient existingLinks={channelLinks} />
    </Suspense>
  );
}
