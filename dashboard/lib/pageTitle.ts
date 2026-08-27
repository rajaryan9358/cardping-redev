import { NAV_ITEMS, PROFILE_ITEMS } from "@/components/shell/Sidebar";

// Sub-routes the sidebar doesn't have its own nav entry for (detail/create/
// edit pages) — checked first since they're more specific than their
// parent nav item, so longer prefixes must win over shorter ones below.
const EXTRA_ROUTES = [
  { href: "/events/new", label: "Create Event" },
  { href: "/events", label: "Event Details", matchChildOnly: true },
  { href: "/directory", label: "Contact Details", matchChildOnly: true },
  { href: "/subscription/topup", label: "Top Up" },
  { href: "/channels/link", label: "Link a Channel" },
];

const ALL_ROUTES = [...NAV_ITEMS, ...PROFILE_ITEMS];

/** Current page's name for the TopBar — longest-matching-prefix wins so a
 * detail page (e.g. /events/abc123) doesn't just say "Events". */
export function pageTitle(pathname: string): string {
  const candidates = [
    ...EXTRA_ROUTES.filter((r) => (r.matchChildOnly ? pathname !== r.href && pathname.startsWith(r.href) : pathname.startsWith(r.href))),
    ...ALL_ROUTES.filter((r) => pathname.startsWith(r.href)),
  ];
  candidates.sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.label ?? "CardPing";
}
