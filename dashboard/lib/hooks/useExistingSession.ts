"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/lib/clientFetch";

interface ExistingAccount {
  id: string;
  email: string | null;
}

/** Used on the signup/login pages to detect a session that's already
 * active when a bot's ?onboard= link is opened — the "you're signed in as
 * X, connect this channel or log out" case. `enabled` skips the request
 * entirely when there's no onboard token in play, since that's the only
 * scenario this matters for. */
export function useExistingSession(enabled: boolean): { loading: boolean; account: ExistingAccount | null } {
  const [loading, setLoading] = useState(enabled);
  const [account, setAccount] = useState<ExistingAccount | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    clientFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAccount(data?.account ?? null))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { loading, account };
}
