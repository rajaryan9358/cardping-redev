import { getCurrentAccount } from "@/lib/data/account";
import { getPlans } from "@/lib/data/billing";
import { getNotifications } from "@/lib/data/notifications";
import { getPlanStatus } from "@/lib/planStatus";
import { MobileNavProvider } from "./MobileNavContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Wraps every authenticated page — the single place the shell is
 * assembled. Individual pages never render their own sidebar/topbar. Below
 * md, the sidebar becomes a slide-in drawer (see MobileNavContext) instead
 * of pushing content over — a fair number of visits start from a bot-
 * issued magic-login link opened on a phone. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [account, notifications, plans] = await Promise.all([
    getCurrentAccount(),
    getNotifications(),
    getPlans(),
  ]);
  const planStatus = getPlanStatus(account, plans);

  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-canvas">
        <Sidebar planLabel={planStatus.label} planTone={planStatus.tone} hasPassword={account.hasPassword} />
        <TopBar
          coinBalance={account.coinBalance}
          avatarUrl={account.avatarUrl}
          accountName={account.fullName}
          accountEmail={account.email}
          notifications={notifications}
        />
        <main className="mt-16 min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 md:ml-64 md:px-8 md:py-10">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6 md:gap-10">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
