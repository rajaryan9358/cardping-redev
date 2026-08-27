import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Contact,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  LucideIcon,
  Mic,
  QrCode,
  Share2,
  Tag as TagIcon,
} from "lucide-react";
import { adminCardsRepo } from "../../../../lib/repositories/adminCards.repo";
import { TableCard } from "../../../../components/ui/Table";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { BackLink } from "../../../../components/ui/BackLink";
import { formatDateTime } from "../../../../lib/format";
import { CardDetailActions } from "./CardDetailActions";
import { CardImagesSection } from "./CardImagesSection";
import { ChannelIcon } from "@/components/ChannelIcon";

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

type MultiValueKind = "text" | "tel" | "email" | "url";

// A field can hold more than one value now (see
// server/db/2026-08-27_card_multi_value_fields.sql) — stored as one
// newline-joined column, shown here as its own stacked, individually
// actionable box per value (in the order extraction found them — see
// visionPrompt.ts's "most prominent first" instruction).
function MultiValueField({ label, value, kind = "text" }: { label: string; value: string | null; kind?: MultiValueKind }) {
  const lines = value?.split("\n").filter((l) => l.trim().length > 0) ?? [];
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => {
          const href =
            kind === "tel" ? `tel:${line}` : kind === "email" ? `mailto:${line}` : kind === "url" ? toHref(line) : null;
          const external = kind === "url";
          const content = <span className="truncate text-sm text-ink">{line}</span>;
          const boxClass =
            "flex items-center justify-between gap-2 rounded-lg border border-border bg-active-bg px-3.5 py-2.5" +
            (href ? " transition-colors hover:border-accent hover:bg-accent-soft/40" : "");

          if (!href) {
            return (
              <div key={i} className={boxClass}>
                {content}
              </div>
            );
          }
          return (
            <a key={i} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={boxClass}>
              {content}
              {external && <ExternalLink className="size-3.5 shrink-0 text-muted" strokeWidth={2} />}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function CardDetailPage({ params }: { params: { cardId: string } }) {
  const card = await adminCardsRepo.getCardById(params.cardId);
  if (!card) notFound();
  const voiceNotes = await adminCardsRepo.listVoiceNotesForCard(card.id);

  return (
    <div className="flex flex-col gap-6">
      <BackLink basePath="/cards" label="Back to cards" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{card.full_name || "Unnamed card"}</h1>
            {card.archived && <Badge tone="pending">Archived</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {card.company_name || "—"} · Scanned {formatDateTime(card.created_at)} via{" "}
            <ChannelIcon channel={card.uploaded_by} size={16} />
            {card.extraction_confidence !== null && ` · ${Math.round(card.extraction_confidence * 100)}% confidence`}
            {card.extraction_model && ` · Extracted with ${card.extraction_provider ?? ""} / ${card.extraction_model}`}
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
              <MultiValueField label="Business Email" value={card.business_email} kind="email" />
              <MultiValueField label="Personal Email" value={card.personal_email} kind="email" />
              <MultiValueField label="Phone" value={card.phone1} kind="tel" />
              {/* phone2 only ever has data on cards scanned before phones
                  consolidated into one field — see visitingCards.repo.ts. */}
              <Field label="Phone (legacy)" value={card.phone2} />
              <MultiValueField label="Website" value={card.website} kind="url" />
              <MultiValueField label="Address" value={card.address} />
            </div>
          </Section>

          {card.qr_code_content && (
            <Section title="QR Code" icon={QrCode}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink">{card.qr_code_content}</span>
                <a href={card.qr_code_content} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="shrink-0 gap-1.5">
                    Open <ExternalLink className="size-3.5" strokeWidth={2} />
                  </Button>
                </a>
              </div>
            </Section>
          )}

          {card.additional_info && (
            <Section title="Additional Info" icon={FileText}>
              <p className="whitespace-pre-line text-sm text-ink">{card.additional_info}</p>
            </Section>
          )}

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
            <CardImagesSection
              frontUrl={card.image_public_url}
              backUrl={card.back_image_public_url}
              fullName={card.full_name || ""}
            />
          </Section>

          <Section title="Voice Notes" icon={Mic}>
            {voiceNotes.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">
                No voice notes added.
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {voiceNotes.map((note) => (
                  <li key={note.id} className="flex flex-col gap-2 rounded-lg border border-border bg-active-bg p-3.5">
                    <span className="text-xs text-muted">{formatDateTime(note.created_at)}</span>
                    <audio controls src={note.public_url} className="w-full" />
                    {note.transcript && <p className="text-sm text-ink">{note.transcript}</p>}
                  </li>
                ))}
              </ol>
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
