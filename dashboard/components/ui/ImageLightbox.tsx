"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/** Full-screen click-to-enlarge viewer for a single image — not built on
 * top of Modal since that component always renders a titled header bar
 * and padded body, which fights an edge-to-edge image. Renders nothing
 * when `src` is null, so callers can mount it once per page and just
 * flip `src` between a URL and null. */
export function ImageLightbox({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="size-5" strokeWidth={2} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- same reasoning as the thumbnail this enlarges */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
