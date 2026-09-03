import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { adminSubscriptionsRepo, EarningType } from "../../../../lib/repositories/adminSubscriptions.repo";
import { EarningsTable } from "./EarningsTable";

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;
const VALID_TYPES: EarningType[] = ["subscription_payment", "coin_purchase"];

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; type?: string; from?: string; to?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : DEFAULT_PAGE_SIZE;
  const type = VALID_TYPES.includes(searchParams.type as EarningType) ? (searchParams.type as EarningType) : undefined;
  const from = searchParams.from || undefined;
  const to = searchParams.to || undefined;

  const { rows, total, sumInr } = await adminSubscriptionsRepo.listEarningTransactions({ type, from, to, page, pageSize });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/subscriptions" className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Subscriptions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Total earnings</h1>
        <p className="mt-1 text-sm text-muted">Every completed subscription payment and top-up purchase.</p>
      </div>

      <EarningsTable rows={rows} total={total} sumInr={sumInr} page={page} pageSize={pageSize} type={type ?? ""} from={from ?? ""} to={to ?? ""} />
    </div>
  );
}
