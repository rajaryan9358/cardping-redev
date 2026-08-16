import { ProfileHeader } from "../ProfileHeader";
import { PersonalInfoForm } from "./PersonalInfoForm";
import { getCurrentAccount } from "@/lib/data/account";

export default async function PersonalInfoPage() {
  const account = await getCurrentAccount();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader title="Personal Information" description="Manage your name, email, and profile photo." />
      <PersonalInfoForm account={account} />
    </div>
  );
}
