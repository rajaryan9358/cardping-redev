import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth";
import { adminEventsRepo } from "../../../../lib/repositories/adminEvents.repo";
import { rowsToCsv } from "../../../../lib/csv";

// (protected)/layout.tsx's requireAdmin() guard is a layout-level check
// that only applies to the page render tree — a Route Handler doesn't
// inherit it, so this calls it itself, same as every Server Action does.
export async function GET(req: NextRequest) {
  await requireAdmin();

  const params = req.nextUrl.searchParams;
  const search = params.get("search") || undefined;
  const sort = params.get("sort") || undefined;

  const rows = await adminEventsRepo.listEventsForExport({ search, sort });
  const csv = rowsToCsv(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      location: r.location ?? "",
      event_date: r.event_date ?? "",
      owner_name: r.owner?.full_name ?? "",
      owner_email: r.owner?.email ?? "",
      card_count: r.cardCount,
      created_at: r.created_at,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="events-export.csv"',
    },
  });
}
