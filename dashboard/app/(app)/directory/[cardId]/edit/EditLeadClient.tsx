"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ImageUploadSlot } from "@/components/ui/ImageUploadSlot";
import { VoiceNoteField } from "@/components/ui/VoiceNoteField";
import { VisitingCard } from "@/lib/types";
import { clientFetch, parseJsonOrThrow } from "@/lib/clientFetch";

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const value = (name: string) => (form.get(name) as string) || null;

    setSaving(true);
    try {
      const res = await clientFetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: value("fullName") ?? card.fullName,
          jobTitle: value("jobTitle"),
          companyName: value("companyName"),
          businessEmail: value("businessEmail"),
          personalEmail: value("personalEmail"),
          phone1: value("phone1"),
          phone2: value("phone2"),
          website: value("website"),
          address: value("address"),
          linkedin: value("linkedin"),
          twitter: value("twitter"),
          facebook: value("facebook"),
          instagram: value("instagram"),
          transcribedNote: value("transcribedNote"),
        }),
      });
      await parseJsonOrThrow(res);
      router.push(`/directory/${card.id}`);
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
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
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger-bg px-3.5 py-2.5 text-sm text-danger-text">{error}</p>}

      <Section title="Contact Information">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Full Name" name="fullName" defaultValue={card.fullName} />
            <Field label="Position" name="jobTitle" defaultValue={card.jobTitle ?? ""} />
          </div>
          <Field label="Company Name" name="companyName" defaultValue={card.companyName ?? ""} />
          <div className="grid grid-cols-2 gap-5">
            <Field label="Business Email" name="businessEmail" type="email" defaultValue={card.businessEmail ?? ""} />
            <Field label="Personal Email" name="personalEmail" type="email" defaultValue={card.personalEmail ?? ""} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Phone 1 (Mobile)" name="phone1" defaultValue={card.phone1 ?? ""} />
            <Field label="Phone 2 (Work)" name="phone2" defaultValue={card.phone2 ?? ""} placeholder="Optional" />
          </div>
          <Field label="Website" name="website" defaultValue={card.website ?? ""} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Address</label>
            <textarea
              name="address"
              defaultValue={card.address ?? ""}
              rows={2}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </Section>

      <Section title="Social Profiles">
        <div className="grid grid-cols-2 gap-5">
          <Field label="LinkedIn" name="linkedin" linkIcon defaultValue={card.linkedin ?? ""} />
          <Field label="Twitter" name="twitter" linkIcon defaultValue={card.twitter ?? ""} />
          <Field label="Facebook" name="facebook" linkIcon defaultValue={card.facebook ?? ""} placeholder="URL" />
          <Field label="Instagram" name="instagram" linkIcon defaultValue={card.instagram ?? ""} placeholder="URL" />
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
              name="transcribedNote"
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
