import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminEventsRepo } from "../../../../lib/repositories/adminEvents.repo";
import { TableCard, TableHeaderRow, Th, Tr, Td } from "../../../../components/ui/Table";
import { formatDate, formatDateTime } from "../../../../lib/format";

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const event = await adminEventsRepo.getEventDetail(params.eventId);
  if (!event) notFound();

  const cards = await adminEventsRepo.getEventCards(params.eventId);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/events" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to events
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-ink">{event.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Owner:{" "}
          {event.user_id ? (
            <Link href={`/users/${event.user_id}`} className="text-accent hover:underline">
              {event.owner?.full_name || event.owner?.email || "Unknown"}
            </Link>
          ) : (
            "—"
          )}{" "}
          · Created {formatDate(event.created_at)} · {cards.length} cards
        </p>
      </div>

      <TableCard>
        <TableHeaderRow>
          <Th>Name</Th>
          <Th>Company</Th>
          <Th>Channel</Th>
          <Th align="right">Confidence</Th>
          <Th align="right">Scanned</Th>
        </TableHeaderRow>
        {cards.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted">No cards yet.</p>}
        {cards.map((card) => (
          <Tr key={card.id}>
            <Td className="font-medium text-ink">{card.full_name || "—"}</Td>
            <Td>{card.company_name || "—"}</Td>
            <Td className="capitalize">{card.uploaded_by || "—"}</Td>
            <Td align="right">
              {card.extraction_confidence !== null ? `${Math.round(card.extraction_confidence * 100)}%` : "—"}
            </Td>
            <Td align="right">{formatDateTime(card.created_at)}</Td>
          </Tr>
        ))}
      </TableCard>
    </div>
  );
}
