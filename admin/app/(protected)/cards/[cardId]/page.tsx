import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Contact, History, Image as ImageIcon, LucideIcon, Mic, Share2, Tag as TagIcon } from "lucide-react";
import { adminCardsRepo } from "../../../../lib/repositories/adminCards.repo";
import { TableCard } from "../../../../components/ui/Table";
import { Badge } from "../../../../components/ui/Badge";
import { formatDateTime } from "../../../../lib/format";
import { CardDetailActions } from "./CardDetailActions";

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <h3 className="flex items-center gap-2 pb-4 text-sm font-semibold text-ink">
        <Icon className="size-4 text-accent" strokeWidth={2} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{card.full_name || "Unnamed card"}</h1>
            {card.archived && <Badge tone="pending">Archived</Badge>}
          </div>
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
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Contact Information" icon={Contact}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business Email" value={card.business_email} />
              <Field label="Personal Email" value={card.personal_email} />
              <Field label="Phone 1" value={card.phone1} />
              <Field label="Phone 2" value={card.phone2} />
              <Field label="Website" value={card.website} />
              <Field label="Address" value={card.address} />
            </div>
          </Section>

          {(card.linkedin || card.twitter || card.facebook || card.instagram) && (
            <Section title="Social Profiles" icon={Share2}>
              <div className="flex flex-wrap gap-2">
                {[
                  ["LinkedIn", card.linkedin],
                  ["Twitter", card.twitter],
                  ["Facebook", card.facebook],
                  ["Instagram", card.instagram],
                ]
                  .filter(([, url]) => url)
                  .map(([label, url]) => (
                    <a
                      key={label}
                      href={/^https?:\/\//i.test(url as string) ? (url as string) : `https://${url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-active-bg px-3 py-1.5 text-xs font-medium text-muted-2 hover:bg-accent-soft hover:text-accent-text"
                    >
                      {label}
                    </a>
                  ))}
              </div>
            </Section>
          )}

          <Section title="Card Images" icon={ImageIcon}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["Front", card.image_public_url],
                  ["Back", card.back_image_public_url],
                ] as const
              ).map(([side, src]) => (
                <div key={side} className="flex flex-col gap-2">
                  <span className="text-xs text-muted">{side}</span>
                  <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-active-bg text-muted">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a scanned
                      // card's aspect ratio varies per photo, and this app has no
                      // remote image domain configured for next/image.
                      <img src={src} alt={`${side} of ${card.full_name || "card"}`} className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-6" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Media & Notes" icon={Mic}>
            {card.voice_note_public_url ? (
              <div className="flex flex-col gap-2">
                <audio controls src={card.voice_note_public_url} className="w-full" />
                {card.transcribed_note && <p className="text-sm text-muted">{card.transcribed_note}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">
                No voice note added.
              </div>
            )}
            {card.summary && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Summary</p>
                <p className="mt-1 text-sm text-ink">{card.summary}</p>
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          {card.tags?.length > 0 && (
            <Section title="Tags" icon={TagIcon}>
              <div className="flex flex-wrap gap-2">
                {card.tags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-active-bg px-3 py-1 text-xs font-medium text-muted-2">
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* No backing table exists for a per-card interaction timeline in
              this product yet — dashboard/lib/data/cards.ts#getInteractions
              is a stub that always returns []; this mirrors that same empty
              state rather than inventing data that doesn't exist. */}
          <Section title="Interaction History" icon={History}>
            <p className="text-center text-sm text-muted">No activity yet.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
