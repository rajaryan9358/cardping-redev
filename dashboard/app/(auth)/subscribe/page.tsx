import { Suspense } from "react";
import { getCurrentAccount } from "@/lib/data/account";
import { getPlans } from "@/lib/data/billing";
import { QuickSubscribeClient } from "./QuickSubscribeClient";

// Where a bot-issued magic-login link (see server/src/services/
// magicLoginService.ts) lands for "Subscribe to a plan" — deliberately
// outside (app)/, which is a fixed-width desktop shell with no mobile
// support, and deliberately without a link back into it: just the plan
// picker.
export default async function QuickSubscribePage() {
  const [account, plans] = await Promise.all([getCurrentAccount(), getPlans()]);
  return (
    <Suspense>
      <QuickSubscribeClient account={account} plans={plans} />
    </Suspense>
  );
}
