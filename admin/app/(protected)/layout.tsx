import { requireAdmin } from "../../lib/auth";
import { AppShell } from "../../components/shell/AppShell";

// Every page under this layout reads live DB state (or, for /env, the
// filesystem) on every request — Next's build-time prerender attempt can
// hit those side effects before it notices this layout's cookies() call
// forces dynamic rendering anyway, producing noisy (harmless) errors in
// the build log. Force it explicitly instead of relying on inference.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AppShell adminEmail={admin.email}>{children}</AppShell>;
}
