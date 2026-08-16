import { ProfileHeader } from "../ProfileHeader";
import { TransactionsClient } from "./TransactionsClient";
import { getTransactions } from "@/lib/data/billing";

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader title="Transaction History" description="Your subscription payments and coin purchases." />
      <TransactionsClient transactions={transactions} />
    </div>
  );
}
