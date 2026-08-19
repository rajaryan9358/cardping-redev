"use client";

import { clientFetch } from "./clientFetch";

/** Used by every logout entry point (Sidebar, AvatarMenu, Sessions page) —
 * clears the session server-side before navigating, so a browser back
 * button after logout doesn't land on a page that still thinks it's
 * authenticated. */
export async function performLogout(): Promise<void> {
  await clientFetch("/api/auth/logout", { method: "POST" }).catch(() => {
    /* best-effort — still navigate to /login even if the request failed */
  });
  window.location.href = "/login";
}
