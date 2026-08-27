"use client";

import { useEffect, useState } from "react";

export interface AuthConfig {
  googleEnabled: boolean;
  whatsappOtpEnabled: boolean;
  startingCoins: number;
  /** True until /api/auth/config resolves. Callers should render buttons
   * gated on *Enabled fields in a neutral "checking" state while this is
   * true, rather than a fully-disabled/greyed one — the config defaults
   * to false so a fetch that's merely slow doesn't otherwise look
   * identical to a feature that's actually turned off. */
  loading: boolean;
}

/** Login/signup render Google and Mobile OTP disabled-with-tooltip once
 * this resolves false — both need external setup (a Meta-approved
 * template, a Google Cloud redirect URI) this session can't complete
 * itself, so the server reports whether they're actually configured
 * instead of the frontend offering a dead click. Starts as "everything
 * disabled" rather than "everything enabled" so there's no flash of a
 * clickable button that turns out not to work; `loading` lets callers
 * distinguish that starting state from a confirmed-off one. */
export function useAuthConfig(): AuthConfig {
  const [config, setConfig] = useState<Omit<AuthConfig, "loading">>({
    googleEnabled: false,
    whatsappOtpEnabled: false,
    startingCoins: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {
        /* stays disabled on failure — no worse than the default */
      })
      .finally(() => setLoading(false));
  }, []);

  return { ...config, loading };
}
