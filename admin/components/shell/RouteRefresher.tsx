"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/** Forces a fresh server fetch on every in-app navigation — including
 * filter/tab/pagination changes that only touch the query string (e.g.
 * Cards' confidence tabs, Users' status tabs), which stay on the same
 * pathname and so were missed by an earlier version of this component
 * that only watched usePathname(). Next's client Router Cache keys its
 * entries by full URL (path + search params) and keeps an already-visited
 * one in memory indefinitely, serving it instantly on revisit with no
 * network request at all — `experimental.staleTimes` (next.config.js)
 * only governs the separate *prefetch* cache for links not yet visited,
 * not this one. Mounted once in the protected layout so every admin page
 * stays live (coin balances, block state, plan status, which cards
 * still exist — none of this is safe to show stale) without needing a
 * hard reload. Skips the very first render — that page's data already
 * came from a fresh SSR response, no need to double-fetch it. */
function RouteRefresherInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    router.refresh();
  }, [pathname, searchParams, router]);

  return null;
}

// useSearchParams() requires a Suspense boundary in the App Router, even
// for a component that renders nothing — without this, the build either
// errors or de-opts the whole layout tree into client-side rendering.
export function RouteRefresher() {
  return (
    <Suspense fallback={null}>
      <RouteRefresherInner />
    </Suspense>
  );
}
