"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { ImageLightbox } from "../../../../components/ui/ImageLightbox";

export function CardImagesSection({
  frontUrl,
  backUrl,
  fullName,
}: {
  frontUrl: string | null;
  backUrl: string | null;
  fullName: string;
}) {
  const [enlarged, setEnlarged] = useState<{ src: string; alt: string } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            ["Front", frontUrl],
            ["Back", backUrl],
          ] as const
        ).map(([side, src]) => (
          <div key={side} className="flex flex-col gap-2">
            <span className="text-xs text-muted">{side}</span>
            <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-active-bg text-muted">
              {src ? (
                <button
                  type="button"
                  onClick={() => setEnlarged({ src, alt: `${side} of ${fullName || "card"}` })}
                  className="size-full cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a scanned
                      card's aspect ratio varies per photo, and this app has no
                      remote image domain configured for next/image. */}
                  <img src={src} alt={`${side} of ${fullName || "card"}`} className="size-full object-cover" />
                </button>
              ) : (
                <ImageIcon className="size-6" strokeWidth={1.5} />
              )}
            </div>
          </div>
        ))}
      </div>

      <ImageLightbox src={enlarged?.src ?? null} alt={enlarged?.alt ?? ""} onClose={() => setEnlarged(null)} />
    </>
  );
}
