"use client";

import { useEffect, useState } from "react";

/** Animates a number from `from` to `to` over `durationMs`, easing out. */
export function useCountUp(from: number, to: number, durationMs = 800): number {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (from === to) {
      setValue(to);
      return;
    }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, durationMs]);

  return value;
}
