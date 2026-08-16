import { SubscriptionClient } from "./SubscriptionClient";
import { getCurrentAccount } from "@/lib/data/account";
import { getPlans } from "@/lib/data/billing";

export default async function SubscriptionPage() {
  const [account, plans] = await Promise.all([getCurrentAccount(), getPlans()]);
  return <SubscriptionClient account={account} plans={plans} />;
}
