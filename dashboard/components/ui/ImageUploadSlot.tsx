"use client";

import { Image as ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";

export function ImageUploadSlot({ label, initialUrl }: { label: string; initialUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="group relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-active-bg text-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: preview URLs aren't supported by next/image
          <img src={preview} alt={label} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6" strokeWidth={1.5} />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink/0 text-xs font-semibold text-transparent transition-colors group-hover:bg-ink/50 group-hover:text-white"
        >
          <Upload className="size-3.5" strokeWidth={2} /> {preview ? "Replace" : "Upload"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}
