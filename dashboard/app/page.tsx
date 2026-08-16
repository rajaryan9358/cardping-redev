import { redirect } from "next/navigation";

export default function RootPage() {
  // No auth wired up yet (frontend-only pass) — always send visitors to login.
  redirect("/login");
}
