import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminCardsRepo } from "../../../../lib/repositories/adminCards.repo";
import { TableCard } from "../../../../components/ui/Table";
import { formatDateTime } from "../../../../lib/format";
import { CardDetailActions } from "./CardDetailActions";

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  position: "Job title",
  company_name: "Company",
  business_email: "Business email",
  personal_email: "Personal email",
  phone1: "Phone 1",
  phone2: "Phone 2",
  website: "Website",
  address: "Address",
  linkedin: "LinkedIn",
  twitter: "Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
};

export default async function CardDetailPage({ params }: { params: { cardId: string } }) {
  const card = await adminCardsRepo.getCardById(params.cardId);
  if (!card) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/cards" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to cards
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{card.full_name || "Unnamed card"}</h1>
          <p className="mt-1 text-sm text-muted">
            {card.company_name || "—"} · Scanned {formatDateTime(card.created_at)} via{" "}
            <span className="capitalize">{card.uploaded_by || "—"}</span>
            {card.extraction_confidence !== null && ` · ${Math.round(card.extraction_confidence * 100)}% confidence`}
          </p>
          <p className="mt-1 text-xs text-muted">
            Scanned by{" "}
            <Link href={`/users/${card.user_id}`} className="text-accent hover:underline">
              this person
            </Link>
            {card.event_id && (
              <>
                {" "}
                for{" "}
                <Link href={`/events/${card.event_id}`} className="text-accent hover:underline">
                  this event
                </Link>
              </>
            )}
          </p>
        </div>
        <CardDetailActions card={card} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {card.image_public_url && (
          // eslint-disable-next-line @next/next/no-img-element -- a scanned
          // card's aspect ratio varies per photo; next/image needs a fixed
          // width/height that would distort or letterbox some cards, and
          // this app has no remote image domain configured for it anyway.
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
            <img src={card.image_public_url} alt="Scanned card" className="h-auto w-full object-contain" />
          </div>
        )}

        <div className={card.image_public_url ? "lg:col-span-2" : "lg:col-span-3"}>
          <TableCard>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                  <p className="mt-1 text-sm text-ink">{(card as Record<string, unknown>)[key] as string | null || "—"}</p>
                </div>
              ))}
            </div>
          </TableCard>
        </div>
      </div>

      {(card.transcribed_note || card.summary) && (
        <TableCard>
          <div className="flex flex-col gap-4 p-6">
            {card.transcribed_note && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Voice note transcript</p>
                <p className="mt-1 text-sm text-ink">{card.transcribed_note}</p>
              </div>
            )}
            {card.summary && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Summary</p>
                <p className="mt-1 text-sm text-ink">{card.summary}</p>
              </div>
            )}
          </div>
        </TableCard>
      )}
    </div>
  );
}
