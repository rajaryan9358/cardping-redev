import { adminEventsRepo } from "../../../lib/repositories/adminEvents.repo";
import { EventsTable } from "./EventsTable";

const PAGE_SIZE = 20;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { page?: string; ownerSearch?: string; sort?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const ownerSearch = searchParams.ownerSearch ?? "";
  const sort = searchParams.sort || undefined;
  const { rows, total } = await adminEventsRepo.listEvents({ ownerSearch, sort, page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Events</h1>
        <p className="mt-1 text-sm text-muted">{total} total</p>
      </div>
      <EventsTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} ownerSearch={ownerSearch} sort={sort ?? ""} />
    </div>
  );
}
