"use client";

import {
  Archive,
  ArchiveRestore,
  Contact,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  LucideIcon,
  Mail,
  Mic,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Share2,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { channelLabel } from "@/components/ui/ChannelIcon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TagAutocomplete } from "@/components/ui/TagAutocomplete";
import { VoiceNoteRecorderDialog } from "@/components/ui/VoiceNoteRecorderDialog";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/cn";
import { InteractionEvent, VisitingCard, VoiceNote } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";

function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** A QR code can encode plain text or a vCard, not just a URL — only offer
 * a clickable "Open" for something that actually looks like one. */
function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(value.trim());
}

function SocialLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={toHref(url)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 rounded-full bg-active-bg px-3 py-1.5 text-xs font-medium text-muted-2 transition-colors hover:bg-accent-soft hover:text-accent-text"
    >
      {label}
      <ExternalLink className="size-3" strokeWidth={2} />
    </a>
  );
}

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

/** A field can hold more than one value now (a card can have more than one
 * phone/email/website/address) — stored as one newline-joined column, but
 * shown here as its own stacked, individually-actionable box per value
 * (in the order extraction found them — see visionPrompt.ts's "most
 * prominent first" instruction) rather than run-on lines of plain text. */
function MultiValueField({ label, value, kind = "text" }: { label: string; value: string | null; kind?: MultiValueKind }) {
  const lines = value?.split("\n").filter((l) => l.trim().length > 0) ?? [];
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => {
          const href = kind === "tel" ? `tel:${line}` : kind === "email" ? `mailto:${line}` : kind === "url" ? toHref(line) : null;
          const external = kind === "url";
          const content = <span className="truncate text-sm text-ink">{line}</span>;
          const boxClass =
            "flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-warm px-3.5 py-2.5" +
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

/** First line of a possibly multi-value field — for the quick-action
 * buttons (Call/WhatsApp/Email), which can only target one number/address
 * at a time. */
function firstLine(value: string | null): string | null {
  return value?.split("\n")[0] ?? null;
}

export function CardDetailClient({
  card,
  interactions,
  voiceNotes: initialVoiceNotes,
  allTags,
}: {
  card: VisitingCard;
  interactions: InteractionEvent[];
  voiceNotes: VoiceNote[];
  allTags: string[];
}) {
  const [tags, setTags] = useState(card.tags);
  const [archived, setArchived] = useState(card.archived);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState(initialVoiceNotes);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; alt: string } | null>(null);

  async function confirmToggleArchived() {
    const next = !archived;
    setArchived(next);
    setArchiveOpen(false);
    await clientFetch(`/api/cards/${card.id}`, { method: "PATCH", body: JSON.stringify({ archived: next }) });
  }

  async function updateTags(next: string[]) {
    setTags(next);
    await clientFetch(`/api/cards/${card.id}`, { method: "PATCH", body: JSON.stringify({ tags: next }) });
  }

  async function confirmDelete() {
    await clientFetch(`/api/cards/${card.id}`, { method: "DELETE" });
    // Hard navigation: a soft push to /directory here would repaint the
    // client Router Cache's last snapshot of that list — the just-deleted
    // card still in it — before a refresh could correct it.
    window.location.href = "/directory";
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/directory" className="text-sm text-muted hover:text-ink">
        &larr; Directory
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{card.fullName}</h1>
          <p className="text-sm text-muted">
            {card.jobTitle} {card.companyName && `at ${card.companyName}`}
          </p>
          <p className="pt-1 text-xs text-muted">
            Captured{" "}
            {new Date(card.scannedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {" · "}Source: {card.eventName}
            {" · "}Uploaded via {channelLabel(card.uploadedBy)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="gap-1.5" onClick={() => setArchiveOpen(true)}>
            {archived ? <ArchiveRestore className="size-4" strokeWidth={2} /> : <Archive className="size-4" strokeWidth={2} />}
            {archived ? "Unarchive" : "Archive"}
          </Button>
          <Link href={`/directory/${card.id}/edit`}>
            <Button variant="secondary" className="gap-1.5">
              <Pencil className="size-4" strokeWidth={2} />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" className="gap-1.5" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" strokeWidth={2} />
            Delete
          </Button>
        </div>
      </div>

      {(() => {
        const phone = firstLine(card.phone1);
        const email = firstLine(card.businessEmail) ?? firstLine(card.personalEmail);
        if (!phone && !email) return null;
        return (
          <div className="flex gap-3">
            {phone && (
              <a href={`tel:${phone}`}>
                <Button variant="secondary" className="gap-2">
                  <Phone className="size-4" strokeWidth={2} /> Call
                </Button>
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="gap-2">
                  <Share2 className="size-4" strokeWidth={2} /> WhatsApp
                </Button>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`}>
                <Button variant="secondary" className="gap-2">
                  <Mail className="size-4" strokeWidth={2} /> Email
                </Button>
              </a>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Contact Information" icon={Contact}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MultiValueField label="Business Email" value={card.businessEmail} kind="email" />
              <MultiValueField label="Personal Email" value={card.personalEmail} kind="email" />
              <MultiValueField label="Phone" value={card.phone1} kind="tel" />
              {/* phone2 only ever has data on cards scanned before phones
                  consolidated into one field. */}
              <Field label="Phone (legacy)" value={card.phone2} />
              <MultiValueField label="Website" value={card.website} kind="url" />
              <MultiValueField label="Address" value={card.address} />
            </div>
          </Section>

          {card.qrCodeContent && (
            <Section title="QR Code" icon={QrCode}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink">{card.qrCodeContent}</span>
                {/* Not every QR code encodes a URL (could be a vCard or
                    plain text) — only offer "Open" when it looks like one. */}
                {looksLikeUrl(card.qrCodeContent) && (
                  <a href={toHref(card.qrCodeContent)} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="shrink-0 gap-1.5">
                      Open <ExternalLink className="size-3.5" strokeWidth={2} />
                    </Button>
                  </a>
                )}
              </div>
            </Section>
          )}

          {card.additionalInfo && (
            <Section title="Additional Info" icon={FileText}>
              <p className="whitespace-pre-line text-sm text-ink">{card.additionalInfo}</p>
            </Section>
          )}

          {(card.linkedin || card.twitter || card.facebook || card.instagram) && (
            <Section title="Social Profiles" icon={Share2}>
              <div className="flex flex-wrap gap-2">
                {card.linkedin && <SocialLink label="LinkedIn" url={card.linkedin} />}
                {card.twitter && <SocialLink label="Twitter" url={card.twitter} />}
                {card.facebook && <SocialLink label="Facebook" url={card.facebook} />}
                {card.instagram && <SocialLink label="Instagram" url={card.instagram} />}
              </div>
            </Section>
          )}

          <Section title="Card Images" icon={ImageIcon}>
            <div className={cn("grid grid-cols-1 gap-4", card.imageBackUrl && "sm:grid-cols-2")}>
              {([
                ["Front", card.imageUrl],
                ...(card.imageBackUrl ? ([["Back", card.imageBackUrl]] as const) : []),
              ] as const).map(([side, src]) => (
                <div key={side} className="flex flex-col gap-2">
                  <span className="text-xs text-muted">{side}</span>
                  <div className="flex max-h-80 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-active-bg text-muted">
                    {src ? (
                      <button
                        type="button"
                        onClick={() => setEnlargedImage({ src, alt: `${side} of ${card.fullName}'s card` })}
                        className="flex max-h-80 w-full cursor-zoom-in items-center justify-center"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`${side} of ${card.fullName}'s card`} className="max-h-80 w-auto max-w-full object-contain" />
                      </button>
                    ) : (
                      <ImageIcon className="size-6 py-8" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Voice Notes" icon={Mic}>
            <div className="flex flex-col gap-4">
              <Button variant="secondary" className="w-fit gap-1.5" onClick={() => setRecorderOpen(true)}>
                <Plus className="size-4" strokeWidth={2} />
                Add new voice note
              </Button>

              {voiceNotes.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">
                  No voice notes yet — replies to this card on WhatsApp/Telegram, or notes recorded here, will show up.
                </div>
              ) : (
                <ol className="flex flex-col gap-3">
                  {voiceNotes.map((note) => (
                    <li key={note.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-warm p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted">
                          {new Date(note.recordedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <audio controls src={note.url} className="w-full" />
                      {note.transcript && <p className="text-sm text-ink">{note.transcript}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Tags" icon={TagIcon}>
            <TagAutocomplete tags={tags} onChange={updateTags} suggestions={allTags} />
          </Section>

          <Section title="Interaction History" icon={History}>
            <ol className={cn("flex flex-col gap-4", interactions.length === 0 && "items-center text-center")}>
              {interactions.length === 0 && <li className="text-sm text-muted">No activity yet.</li>}
              {interactions.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-accent-soft pl-3">
                  <span className="text-xs text-muted">
                    {new Date(event.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="text-sm text-ink">{event.label}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${card.fullName}?`}
        description="This can't be undone. The contact and any notes or voice memos attached to it will be permanently removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={archiveOpen}
        title={archived ? `Unarchive ${card.fullName}?` : `Archive ${card.fullName}?`}
        description={
          archived
            ? "This contact will return to your active Directory list."
            : "This contact will be hidden from your active Directory list. You can unarchive it later from the Archived filter."
        }
        confirmLabel={archived ? "Unarchive" : "Archive"}
        danger={!archived}
        onConfirm={confirmToggleArchived}
        onCancel={() => setArchiveOpen(false)}
      />

      <VoiceNoteRecorderDialog
        cardId={card.id}
        open={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onSaved={(note) => setVoiceNotes((prev) => [note, ...prev])}
      />

      <ImageLightbox
        src={enlargedImage?.src ?? null}
        alt={enlargedImage?.alt ?? ""}
        onClose={() => setEnlargedImage(null)}
      />
    </div>
  );
}
