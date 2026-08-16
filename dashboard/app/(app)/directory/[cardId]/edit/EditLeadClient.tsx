"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ImageUploadSlot } from "@/components/ui/ImageUploadSlot";
import { VoiceNoteField } from "@/components/ui/VoiceNoteField";
import { VisitingCard } from "@/lib/types";

function Field({
  label,
  linkIcon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; linkIcon?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      <div className="relative">
        {linkIcon && <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} />}
        <input
          className={`w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${linkIcon ? "pl-9" : ""}`}
          {...props}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="pb-5 text-base font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function EditLeadClient({ card }: { card: VisitingCard }) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/directory/${card.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/directory/${card.id}`} className="text-sm text-muted hover:text-ink">
            &larr; Back to Directory
          </Link>
          <h1 className="pt-1 text-2xl font-semibold tracking-tight text-ink">Edit Lead</h1>
        </div>
        <div className="flex gap-3">
          <Link href={`/directory/${card.id}`}>
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit">Save Changes</Button>
        </div>
      </div>

      <Section title="Contact Information">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Full Name" defaultValue={card.fullName} />
            <Field label="Position" defaultValue={card.jobTitle ?? ""} />
          </div>
          <Field label="Company Name" defaultValue={card.companyName ?? ""} />
          <div className="grid grid-cols-2 gap-5">
            <Field label="Business Email" type="email" defaultValue={card.businessEmail ?? ""} />
            <Field label="Personal Email" type="email" defaultValue={card.personalEmail ?? ""} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Phone 1 (Mobile)" defaultValue={card.phone1 ?? ""} />
            <Field label="Phone 2 (Work)" defaultValue={card.phone2 ?? ""} placeholder="Optional" />
          </div>
          <Field label="Website" defaultValue={card.website ?? ""} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Address</label>
            <textarea
              defaultValue={card.address ?? ""}
              rows={2}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </Section>

      <Section title="Social Profiles">
        <div className="grid grid-cols-2 gap-5">
          <Field label="LinkedIn" linkIcon defaultValue={card.linkedin ?? ""} />
          <Field label="Twitter" linkIcon defaultValue={card.twitter ?? ""} />
          <Field label="Facebook" linkIcon defaultValue={card.facebook ?? ""} placeholder="URL" />
          <Field label="Instagram" linkIcon defaultValue={card.instagram ?? ""} placeholder="URL" />
        </div>
      </Section>

      <Section title="Media &amp; Notes">
        <div className="flex flex-col gap-5">
          <VoiceNoteField initialUrl={card.voiceNoteUrl} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Transcription / Notes</label>
              {card.transcribedNote && <span className="text-xs text-muted">Auto-transcribed</span>}
            </div>
            <textarea
              defaultValue={card.transcribedNote ?? ""}
              rows={3}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </Section>

      <Section title="Card Scans">
        <div className="grid grid-cols-2 gap-5">
          <ImageUploadSlot label="Front" initialUrl={card.imageUrl} />
          <ImageUploadSlot label="Back" initialUrl={card.imageBackUrl} />
        </div>
      </Section>
    </form>
  );
}
