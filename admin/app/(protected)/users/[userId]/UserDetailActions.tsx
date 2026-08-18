"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { AdminUserRow } from "../../../../lib/repositories/adminUsers.repo";
import { setUserBlockedAction } from "../actions";
import { AdjustCoinsModal } from "../AdjustCoinsModal";

export function UserDetailActions({ user }: { user: AdminUserRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setCoinsOpen(true)}>
        Adjust coins
      </Button>
      <Button variant={user.blocked_at ? "secondary" : "destructive"} onClick={() => setConfirmOpen(true)}>
        {user.blocked_at ? "Unblock" : "Block"}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={user.blocked_at ? "Unblock this user?" : "Block this user?"}
        description={
          user.blocked_at
            ? `${user.full_name || "This user"} will be able to scan cards again.`
            : `${user.full_name || "This user"} will no longer be able to scan cards on WhatsApp or Telegram.`
        }
        confirmLabel={user.blocked_at ? "Unblock" : "Block"}
        danger={!user.blocked_at}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await setUserBlockedAction(user.user_id, !user.blocked_at);
          setConfirmOpen(false);
        }}
      />

      <AdjustCoinsModal user={coinsOpen ? user : null} onClose={() => setCoinsOpen(false)} />
    </div>
  );
}
