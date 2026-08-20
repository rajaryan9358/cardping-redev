"use client";

import {
  Archive,
  ArchiveRestore,
  Contact,
  ExternalLink,
  History,
  Image as ImageIcon,
  LucideIcon,
  Mail,
  Mic,
  Pencil,
  Phone,
  Share2,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TagAutocomplete } from "@/components/ui/TagAutocomplete";
import { cn } from "@/lib/cn";
import { InteractionEvent, VisitingCard } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";

function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

export function CardDetailClient({
  card,
  interactions,
  allTags,
}: {
  card: VisitingCard;
  interactions: InteractionEvent[];
  allTags: string[];
}) {
  const [tags, setTags] = useState(card.tags);
  const [archived, setArchived] = useState(card.archived);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function toggleArchived() {
    const next = !archived;
    setArchived(next);
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
            {" · "}Uploaded via {card.uploadedBy === "whatsapp" ? "WhatsApp" : "Telegram"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="gap-1.5" onClick={toggleArchived}>
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

      {(card.phone1 || card.businessEmail) && (
        <div className="flex gap-3">
          {card.phone1 && (
            <a href={`tel:${card.phone1}`}>
              <Button variant="secondary" className="gap-2">
                <Phone className="size-4" strokeWidth={2} /> Call
              </Button>
            </a>
          )}
          {card.phone1 && (
            <a href={`https://wa.me/${card.phone1.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="gap-2">
                <Share2 className="size-4" strokeWidth={2} /> WhatsApp
              </Button>
            </a>
          )}
          {card.businessEmail && (
            <a href={`mailto:${card.businessEmail}`}>
              <Button variant="secondary" className="gap-2">
                <Mail className="size-4" strokeWidth={2} /> Email
              </Button>
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title="Contact Information" icon={Contact}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business Email" value={card.businessEmail} />
              <Field label="Personal Email" value={card.personalEmail} />
              <Field label="Phone 1" value={card.phone1} />
              <Field label="Phone 2" value={card.phone2} />
              <Field label="Website" value={card.website} />
              <Field label="Address" value={card.address} />
            </div>
          </Section>

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ["Front", card.imageUrl],
                ["Back", card.imageBackUrl],
              ] as const).map(([side, src]) => (
                <div key={side} className="flex flex-col gap-2">
                  <span className="text-xs text-muted">{side}</span>
                  <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-active-bg text-muted">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={`${side} of ${card.fullName}'s card`} className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-6" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Media &amp; Notes" icon={Mic}>
            {card.voiceNoteUrl ? (
              <div className="flex flex-col gap-2">
                <audio controls src={card.voiceNoteUrl} className="w-full" />
                {card.transcribedNote && <p className="text-sm text-muted">{card.transcribedNote}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted">
                No voice note added.
              </div>
            )}
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
    </div>
  );
}
