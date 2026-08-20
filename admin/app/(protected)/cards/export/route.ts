import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth";
import { adminCardsRepo } from "../../../../lib/repositories/adminCards.repo";
import { rowsToCsv } from "../../../../lib/csv";

// (protected)/layout.tsx's requireAdmin() guard is a layout-level check
// that only applies to the page render tree — a Route Handler doesn't
// inherit it, so this calls it itself, same as every Server Action does.
export async function GET(req: NextRequest) {
  await requireAdmin();

  const params = req.nextUrl.searchParams;
  const maxConfidence = Number(params.get("maxConfidence") ?? 1);
  const userIds = params.get("userIds")?.split(",").filter(Boolean);
  const eventId = params.get("eventId") || undefined;
  const search = params.get("search") || undefined;

  const rows = await adminCardsRepo.listCardsForExport({ maxConfidence, userIds, eventId, search });
  const csv = rowsToCsv(rows.map(({ user, ...rest }) => ({ ...rest, scanned_by_name: user?.full_name ?? "", scanned_by_email: user?.email ?? "" })));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cards-export.csv"',
    },
  });
}
