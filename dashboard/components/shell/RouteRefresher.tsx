"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Forces a fresh server fetch on every in-app navigation. Next's client
 * Router Cache keeps an already-visited page's RSC payload in memory
 * indefinitely and serves it instantly on revisit with no network request
 * at all — `experimental.staleTimes` (next.config.js) only governs the
 * separate *prefetch* cache for links not yet visited, not this one, so it
 * doesn't touch the "navigate away and back, see old data" case. Mounted
 * once in the (app) layout so every page under it stays live without
 * needing a hard reload. Skips the very first render — that page's data
 * already came from a fresh SSR response, no need to double-fetch it. */
export function RouteRefresher() {
  const pathname = usePathname();
  const router = useRouter();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  return null;
}
