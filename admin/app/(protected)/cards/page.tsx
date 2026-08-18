import { adminCardsRepo } from "../../../lib/repositories/adminCards.repo";
import { CardsTable } from "./CardsTable";

const PAGE_SIZE = 20;
const DEFAULT_MAX_CONFIDENCE = 0.7;

export default async function CardsPage({
  searchParams,
}: {
  searchParams: { page?: string; maxConfidence?: string; sort?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const maxConfidence = Number(searchParams.maxConfidence ?? DEFAULT_MAX_CONFIDENCE);
  const sort = searchParams.sort || undefined;
  const { rows, total } = await adminCardsRepo.listLowConfidenceCards({
    maxConfidence,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cards</h1>
        <p className="mt-1 text-sm text-muted">
          {total} at or below {Math.round(maxConfidence * 100)}% confidence
        </p>
      </div>
      <CardsTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} maxConfidence={maxConfidence} sort={sort ?? ""} />
    </div>
  );
}
