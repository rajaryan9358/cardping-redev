"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useTransition } from "react";

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
 * came from a fresh SSR response, no need to double-fetch it.
 *
 * router.refresh() is wrapped in a transition so `isPending` is available
 * to show a top progress bar for that window — the navigation itself
 * still paints whatever it already has (a stale cache hit, if this exact
 * URL was visited earlier in the session) the instant you click, there's
 * no way to suppress that first paint. The bar at least makes it visually
 * obvious a correction is in flight, rather than the stale data silently
 * swapping out a moment later looking like a glitch. */
function RouteRefresherInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isFirstRender = useRef(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startTransition(() => {
      router.refresh();
    });
    // router.refresh() itself is stable across renders; only pathname/
    // searchParams changing should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!isPending) return null;
  return (
    <>
      <style>{`
        @keyframes route-refresher-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent">
        <div
          className="h-full w-1/4 bg-accent"
          style={{ animation: "route-refresher-bar 0.9s ease-in-out infinite" }}
        />
      </div>
    </>
  );
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
