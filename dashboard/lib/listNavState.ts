"use client";

// Every list table in this app hard-navigates (window.location.href) for
// filter/sort/page changes and for "View" row actions — see the comment
// on each table's navigate() helper for why (dodging stale Router Cache
// repaints). A full navigation always discards scroll position and any
// query state a caller doesn't explicitly carry over, so a detail page's
// plain "Back to X" link (a bare path, no query string) would otherwise
// drop whatever filters/page/sort the list had and always land scrolled
// to the top. This stores the list's last URL + scroll position per
// pathname (sessionStorage — per-tab, cleared when the tab closes) so a
// detail page can link back to exactly where the user left off.
const PREFIX = "listNav:";

interface SavedListState {
  search: string;
  scrollY: number;
}

/** Call right before navigating away from a list page (e.g. a "View" row
 * action) — snapshots the list's current query string and scroll
 * position under its own pathname. */
export function saveListNavState(basePath: string, search: string): void {
  try {
    const state: SavedListState = { search, scrollY: window.scrollY };
    sessionStorage.setItem(`${PREFIX}${basePath}`, JSON.stringify(state));
  } catch {
    // sessionStorage can throw (private browsing, storage disabled) —
    // losing this is a UX nicety, not a correctness requirement.
  }
}

/** For a detail page's "Back to X" link — the list's last-visited URL
 * (with filters/page/sort intact), falling back to the bare path if
 * nothing was ever saved for it. */
export function getListNavHref(basePath: string): string {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${basePath}`);
    if (!raw) return basePath;
    const { search } = JSON.parse(raw) as SavedListState;
    return search ? `${basePath}?${search}` : basePath;
  } catch {
    return basePath;
  }
}

/** Call once on a list page's mount — restores the saved scroll position,
 * but only if the current URL's query string matches exactly what was
 * saved (a fresh/different navigation to this list shouldn't jump
 * somewhere the user never scrolled to on THIS visit). */
export function restoreListScroll(basePath: string, currentSearch: string): void {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${basePath}`);
    if (!raw) return;
    const { search, scrollY } = JSON.parse(raw) as SavedListState;
    if (search === currentSearch && scrollY > 0) window.scrollTo(0, scrollY);
  } catch {
    // ignore
  }
}
