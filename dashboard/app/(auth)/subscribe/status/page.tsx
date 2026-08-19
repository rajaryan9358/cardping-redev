import { Suspense } from "react";
import { StatusClient } from "../../StatusClient";

// Cashfree's return_url for a checkout that started from the mobile
// /subscribe page (see server/src/routes/api/billing.route.ts's
// buildReturnUrl) — confirms the payment and auto-returns to whichever
// channel the user came from after a few seconds.
export default function SubscribeStatusPage() {
  return (
    <Suspense>
      <StatusClient
        title="Plan activated!"
        description="We're confirming it now — your plan and coin balance will update within a minute or two."
      />
    </Suspense>
  );
}
