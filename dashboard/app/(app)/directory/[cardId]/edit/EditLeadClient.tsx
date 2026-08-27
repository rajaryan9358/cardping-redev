"use client";

import { Link2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ImageUploadSlot } from "@/components/ui/ImageUploadSlot";
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

// For fields that can hold more than one value (a card can have more than
// one phone/email/address) — one per line, matching how they're stored
// and displayed.
function TextAreaField({
  label,
  name,
  defaultValue,
  rows = 2,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}

// Same repeatable-value fields as TextAreaField, but edited as a dynamic
// list of separate boxes (add/remove) instead of one shared textarea —
// order here is preserved as-is (first = primary, see visionPrompt.ts's
// "most prominent first" extraction rule) so dragging isn't offered, only
// add/remove/edit-in-place. Still submits as one newline-joined string via
// a hidden input, so the parent form's FormData-based submit needs no
// changes.
function MultiValueInput({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "url";
}) {
  const [values, setValues] = useState<string[]>(() => {
    const lines = defaultValue.split("\n").filter((l) => l.trim().length > 0);
    return lines.length > 0 ? lines : [""];
  });

  function update(i: number, v: string) {
    setValues((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }
  function remove(i: number) {
    setValues((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [""]));
  }
  function add() {
    setValues((prev) => [...prev, ""]);
  }

  const joined = values.map((v) => v.trim()).filter((v) => v.length > 0).join("\n");

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      <input type="hidden" name={name} value={joined} />
      <div className="flex flex-col gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type={type}
              value={v}
              placeholder={i === 0 ? placeholder : `${placeholder ?? "Value"} (additional)`}
              onChange={(e) => update(i, e.target.value)}
              className="w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-danger-text hover:text-danger-text"
              aria-label={`Remove ${label} value`}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover"
      >
        <Plus className="size-3.5" strokeWidth={2} />
        Add another
      </button>
    </div>
  );
}

export function EditLeadClient({ card }: { card: VisitingCard }) {
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
          qrCodeContent: value("qrCodeContent"),
          additionalInfo: value("additionalInfo"),
        }),
      });
      await parseJsonOrThrow(res);
      // Hard navigation: a soft push back to the detail page would repaint
      // the client Router Cache's pre-edit snapshot of it before a refresh
      // could correct it.
      window.location.href = `/directory/${card.id}`;
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
            <MultiValueInput
              label="Business Email(s)"
              name="businessEmail"
              type="email"
              defaultValue={card.businessEmail ?? ""}
              placeholder="name@company.com"
            />
            <MultiValueInput
              label="Personal Email(s)"
              name="personalEmail"
              type="email"
              defaultValue={card.personalEmail ?? ""}
              placeholder="name@gmail.com — optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <MultiValueInput label="Phone(s)" name="phone1" type="tel" defaultValue={card.phone1 ?? ""} placeholder="+1 234 567 8900" />
            <Field label="Phone (legacy)" name="phone2" defaultValue={card.phone2 ?? ""} placeholder="Optional" />
          </div>
          <MultiValueInput label="Website(s)" name="website" type="url" defaultValue={card.website ?? ""} placeholder="https://example.com" />
          <MultiValueInput label="Address(es)" name="address" defaultValue={card.address ?? ""} placeholder="Street, city, state" />
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

      <Section title="Additional Details">
        <div className="flex flex-col gap-5">
          <Field label="QR Code Content" name="qrCodeContent" defaultValue={card.qrCodeContent ?? ""} placeholder="Optional" />
          <TextAreaField
            label="Additional Info"
            name="additionalInfo"
            defaultValue={card.additionalInfo ?? ""}
            rows={3}
            placeholder="Anything else printed on the card"
          />
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
