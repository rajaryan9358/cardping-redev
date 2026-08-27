"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getListNavHref } from "@/lib/listNavState";

/** "Back to X" link for a detail page — resolves to the list's
 * last-visited filtered/paged URL (see lib/listNavState.ts) instead of
 * always landing on the bare list path. Starts as the bare path (matches
 * server-rendered HTML, avoids a hydration mismatch) and upgrades to the
 * saved URL once mounted client-side, where sessionStorage is available. */
export function BackLink({ basePath, label }: { basePath: string; label: string }) {
  const [href, setHref] = useState(basePath);

  useEffect(() => {
    setHref(getListNavHref(basePath));
  }, [basePath]);

  return (
    <Link href={href} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={2} />
      {label}
    </Link>
  );
}
