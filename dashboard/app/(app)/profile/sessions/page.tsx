import { ProfileHeader } from "../ProfileHeader";
import { SessionsClient } from "./SessionsClient";
import { getSessions } from "@/lib/data/account";

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader title="Sessions" description="Devices currently signed in to your account." />
      <SessionsClient sessions={sessions} />
    </div>
  );
}
