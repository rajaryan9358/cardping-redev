import { TopUpClient } from "./TopUpClient";
import { getCurrentAccount } from "@/lib/data/account";
import { getTopUpPackages } from "@/lib/data/billing";

export default async function TopUpPage() {
  const [account, topUps] = await Promise.all([getCurrentAccount(), getTopUpPackages()]);
  return <TopUpClient account={account} topUps={topUps} />;
}
