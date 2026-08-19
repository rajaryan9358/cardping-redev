import { ProfileHeader } from "../ProfileHeader";
import { PreferencesForm } from "./PreferencesForm";
import { getCurrentAccount } from "@/lib/data/account";

export default async function PreferencesPage() {
  const account = await getCurrentAccount();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        title="Scan Preferences"
        description="Same settings available from the bot's Account Settings menu."
      />
      <PreferencesForm account={account} />
    </div>
  );
}
