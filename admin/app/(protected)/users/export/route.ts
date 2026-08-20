import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth";
import { adminUsersRepo, UserStatusFilter } from "../../../../lib/repositories/adminUsers.repo";
import { rowsToCsv } from "../../../../lib/csv";

const VALID_STATUSES: UserStatusFilter[] = ["active", "blocked", "trial", "subscription", "expired"];

// (protected)/layout.tsx's requireAdmin() guard is a layout-level check
// that only applies to the page render tree — a Route Handler doesn't
// inherit it, so this calls it itself, same as every Server Action does.
export async function GET(req: NextRequest) {
  await requireAdmin();

  const params = req.nextUrl.searchParams;
  const search = params.get("search") || undefined;
  const statusParam = params.get("status");
  const status = VALID_STATUSES.includes(statusParam as UserStatusFilter) ? (statusParam as UserStatusFilter) : undefined;
  const expiresBefore = params.get("expiresBefore") || undefined;
  const expiresAfter = params.get("expiresAfter") || undefined;
  const sort = params.get("sort") || undefined;

  const rows = await adminUsersRepo.listUsersForExport({ search, status, expiresBefore, expiresAfter, sort });
  const csv = rowsToCsv(
    rows.map((r) => ({
      id: r.id,
      full_name: r.full_name ?? "",
      email: r.email ?? "",
      wa_id: r.wa_id ?? "",
      telegram_id: r.telegram_id ?? "",
      subscription_tier: r.subscription_tier ?? "",
      coin_balance: r.effective_coin_balance,
      blocked: r.effective_blocked_at ? "yes" : "no",
      plan_expires_at: r.effective_plan_expires_at ?? "",
      created_at: r.created_at,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="users-export.csv"',
    },
  });
}
