"use client";

import { useEffect, useState } from "react";

export interface AuthConfig {
  googleEnabled: boolean;
  whatsappOtpEnabled: boolean;
  startingCoins: number;
}

/** Login/signup render Google and Mobile OTP disabled-with-tooltip until
 * this loads — both need external setup (a Meta-approved template, a
 * Google Cloud redirect URI) this session can't complete itself, so the
 * server reports whether they're actually configured instead of the
 * frontend offering a dead click. Starts as "everything disabled" rather
 * than "everything enabled" so there's no flash of a clickable button
 * that turns out not to work. */
export function useAuthConfig(): AuthConfig {
  const [config, setConfig] = useState<AuthConfig>({ googleEnabled: false, whatsappOtpEnabled: false, startingCoins: 0 });

  useEffect(() => {
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {
        /* stays disabled on failure — no worse than the default */
      });
  }, []);

  return config;
}
