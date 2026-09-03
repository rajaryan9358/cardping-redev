import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth";
import { adminSubscriptionsRepo, EarningType } from "../../../../../lib/repositories/adminSubscriptions.repo";
import { rowsToCsv } from "../../../../../lib/csv";

const VALID_TYPES: EarningType[] = ["subscription_payment", "coin_purchase"];

// (protected)/layout.tsx's requireAdmin() guard is a layout-level check
// that only applies to the page render tree — a Route Handler doesn't
// inherit it, so this calls it itself, same as every other export route.
export async function GET(req: NextRequest) {
  await requireAdmin();

  const params = req.nextUrl.searchParams;
  const typeParam = params.get("type");
  const type = VALID_TYPES.includes(typeParam as EarningType) ? (typeParam as EarningType) : undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  const rows = await adminSubscriptionsRepo.listEarningTransactionsForExport({ type, from, to });
  const csv = rowsToCsv(
    rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      type: r.type,
      full_name: r.full_name ?? "",
      email: r.email ?? "",
      amount_inr: r.amount_inr,
      user_id: r.detail_user_id ?? "",
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="earnings-export.csv"',
    },
  });
}
