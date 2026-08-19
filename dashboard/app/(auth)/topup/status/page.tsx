import { Suspense } from "react";
import { StatusClient } from "../../StatusClient";

// Cashfree's return_url for a checkout that started from the mobile
// /topup page (see server/src/routes/api/billing.route.ts's buildReturnUrl)
// — confirms the payment and auto-returns to whichever channel the user
// came from after a few seconds.
export default function TopUpStatusPage() {
  return (
    <Suspense>
      <StatusClient
        title="Payment received!"
        description="We're confirming it now — your coin balance will update within a minute or two."
      />
    </Suspense>
  );
}
