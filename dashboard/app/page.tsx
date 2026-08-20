import { redirect } from "next/navigation";

// Forces this route to be handled per-request instead of statically
// pre-rendered at build time. With no dynamic API used before redirect(),
// Next.js otherwise treats this page as fully static and serves a cached
// response that's missing its Location header — any browser landing on
// the bare domain (no path) gets a 307 to nowhere and just shows a blank
// error shell, while a deep link like /login or /home never hits this at
// all. That's the exact "works on some PCs, not others" pattern this fixes.
export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect("/login");
}
