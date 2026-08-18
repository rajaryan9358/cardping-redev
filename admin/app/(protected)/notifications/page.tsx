import { adminNotificationsRepo, NotificationType, NotificationTriggeredBy } from "../../../lib/repositories/adminNotifications.repo";
import { NotificationLogTable } from "./NotificationLogTable";

const PAGE_SIZE = 30;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string; triggeredBy?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const type = searchParams.type ?? "";
  const triggeredBy = searchParams.triggeredBy ?? "";

  const { rows, total } = await adminNotificationsRepo.listNotificationLog({
    page,
    pageSize: PAGE_SIZE,
    type: (type || undefined) as NotificationType | undefined,
    triggeredBy: (triggeredBy || undefined) as NotificationTriggeredBy | undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
        <p className="mt-1 text-sm text-muted">{total} sent</p>
      </div>
      <NotificationLogTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        type={type}
        triggeredBy={triggeredBy}
      />
    </div>
  );
}
