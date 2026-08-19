"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { AdminUserDetail } from "../../../../lib/repositories/adminUsers.repo";
import {
  setUserBlockedAction,
  setAccountBlockedAction,
  setMarketingOptInAction,
  setAccountMarketingOptInAction,
  adjustUserCoinsAction,
  adjustAccountCoinsAction,
} from "../actions";
import { AdjustCoinsModal } from "../AdjustCoinsModal";

export function UserDetailActions({ user }: { user: AdminUserDetail }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [optInPending, setOptInPending] = useState(false);
  const isAccount = user.kind === "account";

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setCoinsOpen(true)}>
        Adjust coins
      </Button>
      <Button
        variant="secondary"
        loading={optInPending}
        onClick={async () => {
          setOptInPending(true);
          const setOptIn = isAccount ? setAccountMarketingOptInAction : setMarketingOptInAction;
          await setOptIn(user.id, !user.marketing_opt_in);
          setOptInPending(false);
        }}
      >
        {user.marketing_opt_in ? "Opt out of marketing" : "Opt in to marketing"}
      </Button>
      <Button variant={user.effective_blocked_at ? "secondary" : "destructive"} onClick={() => setConfirmOpen(true)}>
        {user.effective_blocked_at ? "Unblock" : "Block"}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={user.effective_blocked_at ? "Unblock this user?" : "Block this user?"}
        description={
          user.effective_blocked_at
            ? `${user.full_name || "This user"} will be able to scan cards again.`
            : `${user.full_name || "This user"} will no longer be able to scan cards on WhatsApp or Telegram.`
        }
        confirmLabel={user.effective_blocked_at ? "Unblock" : "Block"}
        danger={!user.effective_blocked_at}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          const setBlocked = isAccount ? setAccountBlockedAction : setUserBlockedAction;
          await setBlocked(user.id, !user.effective_blocked_at);
          setConfirmOpen(false);
        }}
      />

      <AdjustCoinsModal
        target={coinsOpen ? { id: user.id, full_name: user.full_name, effective_coin_balance: user.effective_coin_balance } : null}
        onConfirm={isAccount ? adjustAccountCoinsAction : adjustUserCoinsAction}
        onClose={() => setCoinsOpen(false)}
      />
    </div>
  );
}
