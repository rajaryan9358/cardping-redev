"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { RowActionsMenu } from "../../../components/ui/RowActionsMenu";
import { resendCampaignAction } from "./actions";

export function CampaignActions({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setError(null);
    const result = await resendCampaignAction(campaignId);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <RowActionsMenu
        actions={[
          { label: "Resend", icon: <RefreshCw className="size-3.5" strokeWidth={2} />, onClick: handleResend },
        ]}
      />
      {error && <p className="text-xs text-danger-text">{error}</p>}
    </div>
  );
}
