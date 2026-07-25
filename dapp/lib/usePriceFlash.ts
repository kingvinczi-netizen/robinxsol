"use client";

import { useEffect, useRef, useState } from "react";

/** Flags "up" or "down" for a beat whenever a numeric value ticks, so a moving price reads as alive instead of static text. */
export function usePriceFlash(value: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value === undefined) return;
    if (prev.current !== undefined && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 600);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return flash;
}
