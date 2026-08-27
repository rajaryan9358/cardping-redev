import { adminEventsRepo } from "../../../lib/repositories/adminEvents.repo";
import { EventsTable } from "./EventsTable";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; search?: string; sort?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const search = searchParams.search ?? "";
  const sort = searchParams.sort || undefined;
  const { rows, total } = await adminEventsRepo.listEvents({ search, sort, page, pageSize });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Events</h1>
        <p className="mt-1 text-sm text-muted">{total} total</p>
      </div>
      <EventsTable rows={rows} total={total} page={page} pageSize={pageSize} search={search} sort={sort ?? ""} />
    </div>
  );
}
