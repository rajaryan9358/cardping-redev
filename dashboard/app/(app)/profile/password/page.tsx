import { redirect } from "next/navigation";
import { ProfileHeader } from "../ProfileHeader";
import { PasswordForm } from "./PasswordForm";
import { getCurrentAccount } from "@/lib/data/account";

export default async function PasswordPage() {
  const account = await getCurrentAccount();
  if (!account.hasPassword) redirect("/profile/personal");

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader title="Change Password" description="Update the password used to sign in to your account." />
      <PasswordForm />
    </div>
  );
}
