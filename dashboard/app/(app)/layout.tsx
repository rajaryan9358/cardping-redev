import { AppShell } from "@/components/shell/AppShell";
import { RouteRefresher } from "@/components/shell/RouteRefresher";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteRefresher />
      <AppShell>{children}</AppShell>
    </>
  );
}
