import Link from "next/link";
import { adminUsersRepo, UserStatusFilter, WindowFilter } from "../../../lib/repositories/adminUsers.repo";
import { adminSubscriptionsRepo } from "../../../lib/repositories/adminSubscriptions.repo";
import { env } from "../../../lib/env";
import { cn } from "@/lib/cn";
import { UsersTable } from "./UsersTable";
import { ContactsTable } from "./ContactsTable";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

type View = "accounts" | "whatsapp_contacts" | "telegram_contacts";

const VIEW_TABS: { value: View; label: string }[] = [
  { value: "accounts", label: "Accounts" },
  { value: "whatsapp_contacts", label: "WhatsApp Contacts" },
  { value: "telegram_contacts", label: "Telegram Contacts" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: {
    view?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    expiresBefore?: string;
    expiresAfter?: string;
    coinMin?: string;
    coinMax?: string;
    planId?: string;
    hasWhatsapp?: string;
    hasTelegram?: string;
    window?: string;
    sort?: string;
  };
}) {
  const view: View = VIEW_TABS.some((t) => t.value === searchParams.view) ? (searchParams.view as View) : "accounts";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const search = searchParams.search ?? "";
  const sort = searchParams.sort || undefined;
  const windowFilter = (searchParams.window === "within" || searchParams.window === "outside" ? searchParams.window : undefined) as
    | WindowFilter
    | undefined;

  const tabBar = (
    <div className="flex w-fit flex-wrap gap-1 self-start rounded-xl border border-border bg-surface-warm p-1">
      {VIEW_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "accounts" ? "/users" : `/users?view=${tab.value}`}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            view === tab.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );

  if (view === "whatsapp_contacts" || view === "telegram_contacts") {
    const channel = view === "whatsapp_contacts" ? "whatsapp" : "telegram";
    const { rows, total } = await adminUsersRepo.listChannelContacts(channel, { search, sort, windowFilter, page, pageSize });

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Users</h1>
          <p className="mt-1 text-sm text-muted">{total} total</p>
        </div>
        {tabBar}
        <ContactsTable
          channel={channel}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          search={search}
          sort={sort ?? ""}
          windowFilter={windowFilter ?? ""}
        />
      </div>
    );
  }

  const status = (searchParams.status || undefined) as UserStatusFilter | undefined;
  const expiresBefore = searchParams.expiresBefore || undefined;
  const expiresAfter = searchParams.expiresAfter || undefined;
  const coinMin = searchParams.coinMin ? Number(searchParams.coinMin) : undefined;
  const coinMax = searchParams.coinMax ? Number(searchParams.coinMax) : undefined;
  const planId = searchParams.planId || undefined;
  const hasWhatsapp = searchParams.hasWhatsapp === "1";
  const hasTelegram = searchParams.hasTelegram === "1";
  const [{ rows, total }, plans] = await Promise.all([
    adminUsersRepo.listUsers({
      search,
      status,
      expiresBefore,
      expiresAfter,
      coinMin,
      coinMax,
      planId,
      hasWhatsapp,
      hasTelegram,
      windowFilter,
      sort,
      page,
      pageSize,
    }),
    adminSubscriptionsRepo.listPlans(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">{total} total</p>
      </div>
      {tabBar}
      <UsersTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        status={status ?? ""}
        expiresBefore={expiresBefore ?? ""}
        expiresAfter={expiresAfter ?? ""}
        coinMin={searchParams.coinMin ?? ""}
        coinMax={searchParams.coinMax ?? ""}
        planId={planId ?? ""}
        hasWhatsapp={hasWhatsapp}
        hasTelegram={hasTelegram}
        windowFilter={windowFilter ?? ""}
        sort={sort ?? ""}
        plans={plans}
        lowBalanceThreshold={env.LOW_BALANCE_THRESHOLD}
      />
    </div>
  );
}
