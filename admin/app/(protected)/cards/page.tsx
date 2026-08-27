import { adminCardsRepo } from "../../../lib/repositories/adminCards.repo";
import { CardsTable } from "./CardsTable";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_CONFIDENCE = 1;

export default async function CardsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    pageSize?: string;
    maxConfidence?: string;
    sort?: string;
    userIds?: string;
    userName?: string;
    eventId?: string;
    eventName?: string;
    search?: string;
    hasWhatsapp?: string;
    hasEmail?: string;
    hasPhone?: string;
    hasWebsite?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const maxConfidence = Number(searchParams.maxConfidence ?? DEFAULT_MAX_CONFIDENCE);
  const sort = searchParams.sort || undefined;
  const userIds = searchParams.userIds ? searchParams.userIds.split(",").filter(Boolean) : undefined;
  const eventId = searchParams.eventId || undefined;
  const search = searchParams.search || undefined;
  const hasWhatsapp = searchParams.hasWhatsapp === "true";
  const hasEmail = searchParams.hasEmail === "true";
  const hasPhone = searchParams.hasPhone === "true";
  const hasWebsite = searchParams.hasWebsite === "true";
  const { rows, total } = await adminCardsRepo.listLowConfidenceCards({
    maxConfidence,
    userIds,
    eventId,
    search,
    hasWhatsapp,
    hasEmail,
    hasPhone,
    hasWebsite,
    sort,
    page,
    pageSize,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cards</h1>
        <p className="mt-1 text-sm text-muted">
          {maxConfidence >= 1 ? `${total} cards` : `${total} at or below ${Math.round(maxConfidence * 100)}% confidence`}
        </p>
      </div>
      <CardsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        maxConfidence={maxConfidence}
        sort={sort ?? ""}
        search={search ?? ""}
        hasWhatsapp={hasWhatsapp}
        hasEmail={hasEmail}
        hasPhone={hasPhone}
        hasWebsite={hasWebsite}
        userFilterName={userIds && userIds.length > 0 ? searchParams.userName || "this person" : null}
        eventFilterName={eventId ? searchParams.eventName || "this event" : null}
      />
    </div>
  );
}
