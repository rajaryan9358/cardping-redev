import { Suspense } from "react";
import { getCurrentAccount } from "@/lib/data/account";
import { getTopUpPackages } from "@/lib/data/billing";
import { QuickTopUpClient } from "./QuickTopUpClient";

// Where a bot-issued magic-login link (see server/src/services/
// magicLoginService.ts) lands for "Buy Credits" — deliberately outside
// (app)/, which is a fixed-width desktop shell with no mobile support, and
// deliberately without a link back into it: just the purchase flow.
export default async function QuickTopUpPage() {
  const [account, topUps] = await Promise.all([getCurrentAccount(), getTopUpPackages()]);
  return (
    <Suspense>
      <QuickTopUpClient account={account} topUps={topUps} />
    </Suspense>
  );
}
